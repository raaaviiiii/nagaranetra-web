/**
 * IndexedDB — the household profile and the outbound request queue.
 *
 * Why IndexedDB and not localStorage: the queue holds voice notes, and an audio Blob does
 * not fit in a string store. IndexedDB takes Blobs directly, has room for them, and its
 * writes are transactional — a help request half-written during a browser kill is the one
 * failure mode this queue cannot have.
 *
 * Emergency functions require no account (CLAUDE.md §2), so this device IS the account.
 * Everything here is local; nothing here needs a server to be useful.
 *
 * If IndexedDB is unavailable — private mode in some browsers, an embedded webview, a
 * blocked origin — every function falls back to an in-memory store for the session. The
 * app keeps working; it just forgets when the tab closes. It never throws at a screen.
 */
import type { HelpRequest, Profile } from './contract';

const DB_NAME = 'nagaranetra';
const DB_VERSION = 1;

/** The household profile, plus the bits of context the screens need with it. */
export type StoredProfile = Profile & {
  /** Always 'household' — one profile per device, so the record has a fixed key. */
  id: 'household';
  city: string;
  zoneId: string;
  lat: number;
  lng: number;
  /** Epoch ms, so we can show "registered on…" and tell a stale profile from a fresh one. */
  updatedAt: number;
};

/** One queued outbound call. `clientId` is the idempotency key from contract §6. */
export type QueuedRequest = {
  clientId: string;
  /** Contract path this replays to, e.g. '/requests'. */
  path: string;
  body: HelpRequest;
  /** Optional audio for /intake/voice, held as a Blob — the reason this is IndexedDB. */
  audio?: Blob;
  /** Epoch ms the resident tapped, NOT the time we managed to send. */
  queuedAt: number;
  /** How many send attempts have failed. Shown to the user rather than hidden. */
  attempts: number;
};

const PROFILE_STORE = 'profile';
const OUTBOX_STORE = 'outbox';

/* ---- The in-memory fallback --------------------------------------------------------- */

const memory = {
  profile: null as StoredProfile | null,
  outbox: new Map<string, QueuedRequest>(),
};
let useMemory = false;

/* ---- Connection --------------------------------------------------------------------- */

let connection: Promise<IDBDatabase> | null = null;

function open(): Promise<IDBDatabase> {
  if (connection) return connection;
  connection = new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') {
      reject(new Error('IndexedDB unavailable'));
      return;
    }
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      // keyPath means the record carries its own key — no parallel key bookkeeping.
      if (!db.objectStoreNames.contains(PROFILE_STORE)) db.createObjectStore(PROFILE_STORE, { keyPath: 'id' });
      if (!db.objectStoreNames.contains(OUTBOX_STORE)) db.createObjectStore(OUTBOX_STORE, { keyPath: 'clientId' });
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error('IndexedDB open failed'));
    request.onblocked = () => reject(new Error('IndexedDB blocked by another tab'));
  });
  return connection;
}

/** Wrap one IDBRequest as a promise. */
function promisify<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error('IndexedDB request failed'));
  });
}

/**
 * Run `work` against a store. On any IndexedDB failure it degrades to the in-memory
 * store for the rest of the session, loudly in the console, and never rejects upward.
 */
async function withStore<T>(
  store: string,
  mode: IDBTransactionMode,
  work: (store: IDBObjectStore) => Promise<T>,
  onMemory: () => T,
): Promise<T> {
  if (useMemory) return onMemory();
  try {
    const db = await open();
    const transaction = db.transaction(store, mode);
    const result = await work(transaction.objectStore(store));
    // Let a readwrite transaction actually commit before the caller continues.
    if (mode === 'readwrite') {
      await new Promise<void>((resolve, reject) => {
        transaction.oncomplete = () => resolve();
        transaction.onerror = () => reject(transaction.error ?? new Error('transaction failed'));
        transaction.onabort = () => reject(transaction.error ?? new Error('transaction aborted'));
      });
    }
    return result;
  } catch (error) {
    console.warn('[storage] IndexedDB unavailable, falling back to memory for this session:', error);
    useMemory = true;
    return onMemory();
  }
}

/* ---- The household profile ----------------------------------------------------------- */

export async function loadProfile(): Promise<StoredProfile | null> {
  return withStore(
    PROFILE_STORE,
    'readonly',
    async (store) => (await promisify(store.get('household'))) ?? null,
    () => memory.profile,
  );
}

export async function saveProfile(profile: Omit<StoredProfile, 'id' | 'updatedAt'>): Promise<StoredProfile> {
  const record: StoredProfile = { ...profile, id: 'household', updatedAt: Date.now() };
  await withStore(
    PROFILE_STORE,
    'readwrite',
    async (store) => {
      await promisify(store.put(record));
    },
    () => {
      memory.profile = record;
    },
  );
  return record;
}

export async function clearProfile(): Promise<void> {
  await withStore(
    PROFILE_STORE,
    'readwrite',
    async (store) => {
      await promisify(store.delete('household'));
    },
    () => {
      memory.profile = null;
    },
  );
}

/* ---- The outbound queue --------------------------------------------------------------- */

/** Oldest first: a queue replayed out of order is a queue that reorders emergencies. */
export async function listQueued(): Promise<QueuedRequest[]> {
  const items = await withStore(
    OUTBOX_STORE,
    'readonly',
    async (store) => (await promisify(store.getAll())) as QueuedRequest[],
    () => [...memory.outbox.values()],
  );
  return items.sort((a, b) => a.queuedAt - b.queuedAt);
}

export async function enqueue(item: Omit<QueuedRequest, 'queuedAt' | 'attempts'>): Promise<QueuedRequest> {
  const record: QueuedRequest = { ...item, queuedAt: Date.now(), attempts: 0 };
  await withStore(
    OUTBOX_STORE,
    'readwrite',
    async (store) => {
      // put, not add: replaying the same clientId must overwrite, never duplicate.
      await promisify(store.put(record));
    },
    () => {
      memory.outbox.set(record.clientId, record);
    },
  );
  return record;
}

export async function markAttempted(clientId: string): Promise<void> {
  await withStore(
    OUTBOX_STORE,
    'readwrite',
    async (store) => {
      const existing = (await promisify(store.get(clientId))) as QueuedRequest | undefined;
      if (!existing) return;
      await promisify(store.put({ ...existing, attempts: existing.attempts + 1 }));
    },
    () => {
      const existing = memory.outbox.get(clientId);
      if (existing) memory.outbox.set(clientId, { ...existing, attempts: existing.attempts + 1 });
    },
  );
}

export async function dequeue(clientId: string): Promise<void> {
  await withStore(
    OUTBOX_STORE,
    'readwrite',
    async (store) => {
      await promisify(store.delete(clientId));
    },
    () => {
      memory.outbox.delete(clientId);
    },
  );
}

export async function queueLength(): Promise<number> {
  return (await listQueued()).length;
}

/** Test seam: forget the connection so a test can start from a clean database. */
export function resetForTests(): void {
  connection = null;
  useMemory = false;
  memory.profile = null;
  memory.outbox.clear();
}
