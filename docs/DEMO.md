# NAGARANETRA — Demo runbook

## The claim being demonstrated

Same rainfall, same zone, **different message** — because the system knows the floor, the
building and who lives in the house.

## Before the room

- [ ] `cd web && npm run build && npm run preview` — the demo runs from the built PWA.
- [ ] **Switch the backend off entirely and run it again.** If anything blanks, it is not
      done (CLAUDE.md §3). With no `VITE_API_BASE` set the app is already on committed
      data and the chip reads `Simulated data`.
- [ ] Aeroplane mode, reload: the shell, fonts and scenarios come back from the cache.
- [ ] Check at 390 px as well as on the projector.

## What must never be said on stage

- We do **not** dispatch emergency services. We notify and match; a human authority acts.
- Hazard levels are **modelled**. The geometry is real OSM data; say so — it is on screen.
- Voice recognition is **not** offline. Offline, voice queues as audio.

## Running order

To be written once the end-to-end thread is complete: register → personalised risk page →
hazard rises → household-specific warning → 3D scene → one-tap help request.
