# Committed hazard scenarios

Precomputed scenario snapshots and ward geometry live here as static JSON.

They are **committed on purpose** (CLAUDE.md §3): the deployed demo reads these files, not
the API. No cold start, no round trip, and the service worker caches them, so the whole
demo runs with the backend switched off.

Every file here must match a shape in `docs/API_CONTRACT.md` §6 exactly, and is wired up
through the `SNAPSHOTS` map in `src/lib/mock.ts`.
