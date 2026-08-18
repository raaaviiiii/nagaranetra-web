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

Other scripts: `npm run build`, `npm run preview`, `npm run lint`.

**It runs with the backend switched off.** That is the design, not a fallback: with no
`VITE_API_BASE` set the app serves committed scenario data from `web/public/data/` and the
status chip in the header reads `Simulated data`. Point it at a live API with:

```bash
echo 'VITE_API_BASE=http://localhost:8000' > web/.env.local
```

If a live call fails or takes longer than 2 s, the app falls back to the committed data
**and flips the chip back to `Simulated data`**. It never silently serves stale numbers.

## Layout

```
web/src/lib/          api.ts (the only network call), mock.ts, storage.ts, sync.ts
web/src/routes/       one file per screen
web/src/scene/        Three.js — real OSM geometry
web/src/hazards/      per-hazard renderers + copy
web/src/styles/       tokens.css — the single source of colour
web/public/fonts/     self-hosted woff2. No CDN, ever — offline is a product requirement
web/public/data/      committed hazard scenarios
docs/                 API_CONTRACT.md (frozen), DESIGN.md, DEMO.md
```

Stack: Vite, React, TypeScript, Tailwind, `vite-plugin-pwa`. Motion via `motion`,
primitives via Base UI, toasts via `sonner`, numbers via `number-flow`, charts via
`recharts`, map via `leaflet`, 3D via `three`.

## The backend

Separate repository, owned by a teammate. The contract between the two is **frozen** and
documented in [`docs/API_CONTRACT.md`](docs/API_CONTRACT.md) — it changes only by
agreement, with both repos updated in the same sitting.

API repository: **TODO — add the link once the backend repo exists.**

## Ground rules

- Emergency functions require **no account**. Not a soft login, not a guest account.
- We never claim to dispatch emergency services. We notify and match; a human acts.
- Simulated data is labelled as simulated, visibly, on the face of the product.
- Accessibility is a constraint: accessible names, visible focus, `prefers-reduced-motion`,
  WCAG AA contrast, and an emergency path completable without reading.

See [`CLAUDE.md`](CLAUDE.md) for the full brief.
