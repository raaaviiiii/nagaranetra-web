/**
 * The offline outbox.
 *
 * A help request tapped with no signal must not be lost and must not silently pretend to
 * have been sent. It is queued here, the interface says it is queued, and it is flushed
 * when the device comes back.
 *
 * Note the wording rule from CLAUDE.md §2: delivering an item means the request was
 * NOTIFIED to an authority. We never claim it dispatched anyone.
 */
import { load, save } from './storage';

const OUTBOX_KEY = 'outbox';

export type OutboxItem = {
  /** Stable client id, so a retry cannot create a duplicate request server-side. */
  id: string;
  /** Contract path this item should be POSTed to. */
  path: string;
  /** Serialisable body, exactly as the contract defines it. */
  body: unknown;
  /** Epoch ms the resident tapped, not the time we managed to send. */
  queuedAt: number;
};

export function listQueued(): OutboxItem[] {
  return load<OutboxItem[]>(OUTBOX_KEY, []);
}

export function enqueue(item: Omit<OutboxItem, 'id' | 'queuedAt'>): OutboxItem {
  const queued: OutboxItem = { ...item, id: crypto.randomUUID(), queuedAt: Date.now() };
  save(OUTBOX_KEY, [...listQueued(), queued]);
  return queued;
}

/**
 * Try to send everything queued. `send` is injected rather than imported so this module
 * stays testable and so the network stays behind `api.ts`.
 * Items that fail stay in the queue, in order.
 */
export async function flush(send: (item: OutboxItem) => Promise<void>): Promise<number> {
  const pending = listQueued();
  const remaining: OutboxItem[] = [];
  let sent = 0;

  for (const item of pending) {
    try {
      await send(item);
      sent += 1;
    } catch {
      remaining.push(item);
    }
  }

  save(OUTBOX_KEY, remaining);
  return sent;
}

/** Call once at start-up. Flushes whenever the device regains connectivity. */
export function watchConnectivity(send: (item: OutboxItem) => Promise<void>): () => void {
  const onOnline = () => void flush(send);
  window.addEventListener('online', onOnline);
  return () => window.removeEventListener('online', onOnline);
}
