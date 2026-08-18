# Nagaranetra — web client

Public warnings in India are area-targeted: everyone in a district gets the same sentence,
whether they live on a ground floor or a third floor, whether anyone in the house can
walk, or whether their street floods at 40 cm while the next one floods at 90.
**Nagaranetra knows the household, so the warning is different for every home** — and the
help arrives attached to the warning. This repository is the web client: a PWA a city's
residents use before, during and after a disaster, on a phone, with or without a network.

Built for AI Innovation Hackathon 2026, ASIET — Track T5, AI for Smart Cities.

## Run it

```bash
cd web
npm install
npm run dev        # http://localhost:5173
```

Other scripts: `npm run build`, `npm run preview`, `npm run lint`, `npm run typecheck`.

## It runs with the backend switched off

That is the architecture, not a fallback. Every network call in the app goes through one
module, `web/src/lib/api.ts`, and that module can always answer from a deterministic
in-browser implementation of the same contract.

One flag, three modes:

| `VITE_API_MODE` | Behaviour |
|---|---|
| `mock` | Never touches the network. The default with no API configured, and how we demo. |
| `auto` | Calls the API; on **any** failure — offline, non-2xx, bad body, or a 2 s timeout — falls back to the mock and flips the status chip. Two failures in a row open a circuit breaker, so a hanging backend costs seconds, not 2 s per call. |
| `live` | Always calls the API and lets errors throw. Integration debugging only — never demo in this mode. |

```bash
echo 'VITE_API_BASE=http://localhost:8000' > web/.env.local   # mode becomes 'auto'
```

The header chip reads **Live data**, **Simulated data** or **Offline**, always, with no
dismiss control. If the numbers came from the mock, the product says so on its face.

### Proving it

```bash
cd web
npm run test          # the mock: determinism + the contract's four validation properties
npm run verify:seam   # drives the real api.ts in a real browser against a dead backend
```

`verify:seam` starts a server that accepts connections and never answers, runs all eight
endpoints through the app's own code, then cuts the network at the browser, then removes
the backend entirely — 61 checks covering shape, timing, status and visible chip text.

## Layout

```
web/src/lib/          contract.ts (types), api.ts (the only network call),
                      mock.ts, storage.ts (IndexedDB), sync.ts (offline queue)
web/src/routes/       one file per screen
web/src/scene/        Three.js — real OSM geometry
web/src/hazards/      per-hazard renderers + copy
web/src/styles/       tokens.css — the single source of colour
web/public/fonts/     self-hosted woff2. No CDN, ever — offline is a product requirement
web/public/data/      committed hazard scenarios
web/docs/             API_CONTRACT.md (frozen), DESIGN.md, DEMO.md
web/scripts/          make-icons, shoot (screenshots), verify-seam (the backend-off proof)
```

Stack: Vite, React, TypeScript, Tailwind, `vite-plugin-pwa`. Motion via `motion`,
primitives via Base UI, toasts via `sonner`, numbers via `number-flow`, charts via
`recharts`, map via `leaflet`, 3D via `three`.

## The backend

Separate repository, owned by a teammate. The contract between the two is **frozen** and
documented in [`web/docs/API_CONTRACT.md`](web/docs/API_CONTRACT.md) — it changes only by
agreement, with both repos updated in the same sitting. `web/src/lib/contract.ts` is a
TypeScript mirror of §6 of that document, and `web/src/lib/mock.ts` implements all eight
endpoints, so the frontend was built against the contract before the backend existed.

API repository: **TODO — add the link once the backend repo exists.**

## Ground rules

- Emergency functions require **no account**. Not a soft login, not a guest account.
- We never claim to dispatch emergency services. We notify and match; a human acts.
- Simulated data is labelled as simulated, visibly, on the face of the product.
- Accessibility is a constraint: accessible names, visible focus, `prefers-reduced-motion`,
  WCAG AA contrast, and an emergency path completable without reading.

See [`CLAUDE.md`](CLAUDE.md) for the full brief.
