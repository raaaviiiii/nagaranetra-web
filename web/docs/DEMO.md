# NAGARANETRA — Demo runbook

## The claim being demonstrated

Same rainfall, same zone, **different message** — because the system knows the floor, the
building and who lives in the house.

## Before the room

- [ ] `cd web && npm run build && npm run preview` — the demo runs from the built PWA.
- [ ] `npm run verify:seam` — proves the app survives a hanging backend, a dead network
      and no backend at all. 61 checks; it must print ALL CHECKS PASSED.
- [ ] `npm run test` — the mock's determinism and the contract's four validation properties.
- [ ] **Switch the backend off entirely and run it again.** If anything blanks, it is not
      done (CLAUDE.md §3). With no `VITE_API_BASE` set the app is already on committed
      data and the chip reads `Simulated data`.
- [ ] Aeroplane mode, reload: the shell, fonts and scenarios come back from the cache.
- [ ] Check at 390 px as well as on the projector.

## If the backend dies mid-demo

Nothing to do. The chip flips to `Simulated data` by itself, the circuit breaker stops the
app retrying a dead service, and every screen keeps its numbers. If you are asked about it,
the honest answer is the good one: the seam is designed so the product degrades visibly
rather than silently.

## What must never be said on stage

- We do **not** dispatch emergency services. We notify and match; a human authority acts.
- Hazard levels are **modelled**. The geometry is real OSM data; say so — it is on screen.
- Voice recognition is **not** offline. Offline, voice queues as audio.

## Running order

To be written once the end-to-end thread is complete: register → personalised risk page →
hazard rises → household-specific warning → 3D scene → one-tap help request.
