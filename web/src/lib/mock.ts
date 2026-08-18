/**
 * Deterministic in-browser implementation of the same contract (CLAUDE.md §3).
 *
 * Deterministic matters: the demo must show the same numbers on the fifth run as on the
 * first. Nothing here is random and nothing here reads the clock for its values.
 *
 * Scenarios live as committed JSON under `public/data/`, so they are precached by the
 * service worker and cost no round trip. `resolveMock` maps a contract path to one of
 * those files.
 *
 * Every shape returned here must match `docs/API_CONTRACT.md` §6 exactly — same field
 * names, same enums. If the two drift, integration night becomes integration morning.
 */

/** Contract path -> committed snapshot under /data. Filled in as endpoints are built. */
const SNAPSHOTS: Record<string, string> = {
  // '/hazard/flood': '/data/flood-kochi.json',
};

/** Same-origin, so this still resolves from the service worker cache when offline. */
async function loadSnapshot<T>(file: string): Promise<T> {
  const response = await fetch(file);
  if (!response.ok) throw new Error(`missing committed snapshot ${file}`);
  return (await response.json()) as T;
}

export async function resolveMock<T>(path: string): Promise<T> {
  const file = SNAPSHOTS[path];
  if (!file) {
    // Deliberately loud. A silently empty mock is how a screen ends up showing nothing
    // during a demo with no explanation.
    throw new Error(`[mock] no implementation for ${path} — add it to SNAPSHOTS in mock.ts`);
  }
  return loadSnapshot<T>(file);
}
