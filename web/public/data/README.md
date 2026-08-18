# Committed hazard data

Precomputed scenario snapshots and ward geometry live here as static JSON, committed on
purpose (CLAUDE.md §3, contract §5.1): the deployed demo must never wait on a cold-starting
backend, and the service worker caches whatever is here for free.

## What is here now

Nothing yet — and deliberately so. `src/lib/mock.ts` currently computes the same scenarios
deterministically in the browser, which is strictly better than a snapshot for the forecast
grid: no fetch at all, no parse, and the numbers cannot drift from the model that produced
them. `npm run test` holds it to the contract's validation properties.

## What lands here

- `scenarios/{city}_{hazard}_{intensity}.json` — the backend's `scripts/precompute.py`
  output. When those land, they replace the computed forecast: `mock.ts` gains a loader and
  nothing else in the app changes, because everything already goes through `lib/api.ts`.
- Ward geometry for the 3D scene (OSM footprints and roads), which has to be a file — it is
  too large to compute and too static to fetch.

Anything here must match a shape in `../../docs/API_CONTRACT.md` §6 exactly.
