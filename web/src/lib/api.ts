/**
 * The seam (CLAUDE.md §3).
 *
 * This is the ONLY module in the app that is allowed to touch the network. Every screen
 * calls `request()` and never `fetch()`. That single choke point is what lets the whole
 * demo run with the backend switched off.
 *
 * Behaviour, in order:
 *   1. If the live API is switched off, serve the mock. Source = 'simulated'.
 *   2. Otherwise fetch, with a hard 2s timeout.
 *   3. On ANY failure — network, timeout, non-2xx, unparseable body — fall back to the
 *      mock and flip the source to 'simulated'. Never blank, never silently stale.
 *
 * The source is published so `<StatusChip>` can show it. A fallback that the user cannot
 * see is a lie, and §2 forbids it.
 */
import { resolveMock } from './mock';

/** Where the numbers on screen actually came from. */
export type DataSource = 'live' | 'simulated';

/** The one flag. Flip to true (or set VITE_API_BASE) on integration night. */
export const API_BASE: string | undefined = import.meta.env.VITE_API_BASE;
export const USE_LIVE_API = Boolean(API_BASE);

/** A slow answer during an emergency is a failed answer. */
const TIMEOUT_MS = 2000;

let source: DataSource = USE_LIVE_API ? 'live' : 'simulated';
const listeners = new Set<(s: DataSource) => void>();

export function getSource(): DataSource {
  return source;
}

/** Subscribe to source changes. Returns an unsubscribe fn (useSyncExternalStore shape). */
export function subscribeToSource(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function setSource(next: DataSource) {
  if (next === source) return;
  source = next;
  for (const listener of listeners) listener(next);
}

/**
 * Fetch `path` from the API, or the mock. `path` is the contract path, e.g. `/household`.
 * Never throws for network reasons — it degrades to the mock instead.
 */
export async function request<T>(path: string, init?: RequestInit): Promise<T> {
  if (!USE_LIVE_API) {
    setSource('simulated');
    return resolveMock<T>(path);
  }

  try {
    const response = await fetch(`${API_BASE}${path}`, {
      ...init,
      headers: { 'content-type': 'application/json', ...init?.headers },
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    if (!response.ok) throw new Error(`${path} responded ${response.status}`);
    const body = (await response.json()) as T;
    setSource('live');
    return body;
  } catch (error) {
    // Loud in the console for us, visible in the chip for the resident.
    console.warn(`[api] ${path} fell back to simulated data:`, error);
    setSource('simulated');
    return resolveMock<T>(path);
  }
}
