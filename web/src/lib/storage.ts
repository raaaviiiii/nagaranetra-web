/**
 * Local persistence — the household profile and anything else that must survive a reload
 * with no network and no account (CLAUDE.md §2: emergency functions require no account,
 * so the device IS the account).
 *
 * Every key is namespaced and versioned, so a shape change during the build does not
 * leave a device stuck on an old profile it cannot parse.
 */

const PREFIX = 'nagaranetra.v1.';

/** Private browsing and some embedded webviews throw on localStorage access. */
function safeStorage(): Storage | null {
  try {
    const probe = '__nagaranetra_probe__';
    window.localStorage.setItem(probe, probe);
    window.localStorage.removeItem(probe);
    return window.localStorage;
  } catch {
    return null;
  }
}

export function load<T>(key: string, fallback: T): T {
  const store = safeStorage();
  if (!store) return fallback;
  const raw = store.getItem(PREFIX + key);
  if (raw === null) return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    // Corrupt entry: drop it rather than crash the screen that needed it.
    store.removeItem(PREFIX + key);
    return fallback;
  }
}

export function save<T>(key: string, value: T): void {
  safeStorage()?.setItem(PREFIX + key, JSON.stringify(value));
}

export function remove(key: string): void {
  safeStorage()?.removeItem(PREFIX + key);
}
