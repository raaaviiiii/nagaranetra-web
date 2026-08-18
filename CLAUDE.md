# NAGARANETRA — Frontend Brief

**Read this file at the start of every session. It is the source of truth. If anything you are about to build contradicts this file, stop and ask.**

This repo is **frontend only**. The backend is a separate repo owned by a teammate. The contract between them is frozen and documented in `docs/API_CONTRACT.md` — treat it as immutable. If you believe the contract is wrong, say so; do not silently work around it.

Built for: AI Innovation Hackathon 2026, ASIET — Track T5, AI for Smart Cities. 24 hours.

---

## 1. What we are building

One website a city's residents use **before, during and after** a disaster.

A resident registers their household once. From then on, every message the platform gives them is about **their house** — not their district. It works on a phone, installs to the home screen, and keeps working when the network drops.

It is **not** a flood app and **not** a Kochi app. Hazards are plug-ins; a city switches on the ones it faces.

### The thesis

> Public warnings in India are area-targeted. Everyone in a district gets the same sentence, regardless of whether they live on a ground floor or a third floor, whether anyone in the house can walk, or whether their street floods at 40 cm while the next one floods at 90. Nagaranetra knows the household, so the warning is different for every home — and the help arrives attached to the warning.

### The four things a user does

1. **Register** — address pin, building type, floor level, household size, mobility/medical dependencies, vehicle, language. Under 60 seconds, every field skippable.
2. **Know your place** (normal days) — hazards at your address, nearest hospital / fire / police / shelter, seasonal prep, 3D view of your actual street.
3. **Get warned** (threat rising) — your threshold, your lead time, your action. The 3D scene animates what is coming.
4. **Act** (during / after) — one-tap help request (voice in Malayalam or icons, no login), shelters with live capacity, safe route, mark yourself safe, damage report.

---

## 2. Non-negotiables

Product rules, not preferences.

- **Emergency functions require no account.** Not a soft login, not a guest account. None.
- **Never claim we dispatch emergency services.** We notify and match; a human authority acts.
- **Label simulated data as simulated,** visibly, on the face of the product.
- **Failures must be loud.** If serving cached or mock data, the interface says so. It never quietly serves stale numbers.
- **Never claim offline speech recognition.** Offline, voice queues as audio. Icons and text always work.
- **Accessibility is a constraint.** Every interactive element has an accessible name. Visible keyboard focus. `prefers-reduced-motion` respected. WCAG AA contrast. Emergency path completable without reading.
- **We must be able to explain every line.** The rules penalise auto-generated code the team cannot explain. Prefer clear over clever. Comment anything non-obvious.

---

## 3. The seam — this is the most important section

The backend may be late, broken, or unreachable at any moment tonight. **The frontend must never depend on it being up.**

```
web/src/lib/api.ts        the single place any network call is made
web/src/lib/mock.ts       deterministic in-browser implementation of the same contract
web/public/data/          committed snapshot of precomputed hazard scenarios
```

Rules:

- **Build the mock first, before any screen.** Every screen is developed against `mock.ts`. The real API is switched in later by changing one flag.
- The mock implements `docs/API_CONTRACT.md` **exactly** — same shapes, same field names, same enums. If they diverge, integration night becomes integration morning.
- On any failure or a 2s timeout, fall back to the mock **and flip a visible status chip** from `Live` to `Simulated`. Never blank, never silently stale.
- `normalise*()` functions coerce types and re-derive out-of-range values, so a backend field can degrade without taking the app down.
- Hazard scenarios ship as **committed static JSON** in `web/public/data/`. The deployed demo reads these, not the API. No cold start, no round trip, offline caching for free.

**The demo must be able to run with the backend switched off entirely.** Verify this before you call any feature done.

---

## 4. Structure

```
web/
├── src/
│   ├── routes/
│   │   ├── index.tsx        household dashboard
│   │   ├── setup.tsx        registration
│   │   ├── help.tsx         SOS — no login, offline
│   │   ├── shelters.tsx
│   │   ├── nearby.tsx       emergency services
│   │   ├── damage.tsx
│   │   ├── city.tsx         ward view (dark surface)
│   │   └── styleguide.tsx   the design system, rendered
│   ├── components/
│   ├── scene/               Three.js — real OSM geometry
│   ├── hazards/             per-hazard renderers + copy
│   ├── lib/                 api, mock, storage, sync
│   └── styles/tokens.css
├── public/
│   ├── data/                hazard scenarios + ward geometry
│   └── fonts/               self-hosted woff2, NO CDN
└── docs/
    ├── API_CONTRACT.md      frozen
    ├── DESIGN.md
    └── DEMO.md
```

Stack: Vite + React + TypeScript + Tailwind, PWA via `vite-plugin-pwa`.

---

## 5. Design system

**The subject is public safety infrastructure, not a tech product.** The vernacular comes from Indian public warning systems — IMD's colour ladder, transit signage, government notice boards — executed with real craft. It must not look like a SaaS dashboard.

### Two surfaces, functionally different

- **Citizen — light.** Read outdoors, in daylight, one-handed, under stress. High contrast, large type.
- **City — dark.** Read on a monitor in a room. Dense, instrumented.

They should look like two different products, because they are.

### The aesthetic risk — justify it if asked

**Colour is reserved entirely for hazard level and one action blue. Nothing else is chromatic.** No brand colour, no gradients, no decorative accents. The interface is achromatic until something is wrong. When colour appears on screen, it means something.

### Tokens

```css
/* Citizen — light */
--paper:        #F6F7F5;   /* cool off-white. NOT cream, NOT #F4F1EA */
--paper-raised: #FFFFFF;
--ink:          #14181B;
--ink-muted:    #59636B;
--rule:         #DDE2DE;

/* City — dark */
--base:         #0C1013;
--surface:      #151B20;
--rule-dark:    #232C33;
--ink-dark:     #EAF0F2;

/* IMD warning ladder — the only chromatic colours */
--level-none:    #128A4E;
--level-watch:   #F2C200;
--level-alert:   #EE7415;
--level-warning: #CE1B2C;

/* Human action — deliberately outside the hazard ladder */
--act:           #1B4FD8;
--act-dark:      #5B8CFF;
```

**Everything the system predicts uses the hazard ladder. Everything a person does uses the action blue.**

### Type

| Role | Face | Notes |
|---|---|---|
| Display | **Archivo** (variable) | Grotesque, condensed widths — signage vernacular. Heavy weights, status words only. |
| Body | **Inter** | |
| Malayalam | **Noto Sans Malayalam** | Verify conjuncts and vowel signs shape correctly |
| Numbers | **IBM Plex Mono** | `tabular-nums` everywhere a number changes |

Self-host every font. No CDN — offline is a product requirement.

### Signature element — THE THRESHOLD LINE

**The one thing the product is remembered by. Build it well, repeat it everywhere.**

A horizontal rule with a marker showing where the current forecast sits relative to **this household's** limit. It appears on the status card, the forecast sparkline, and in the 3D scene as the level marker. When the forecast crosses the threshold, the line moves and the colour steps up the ladder — in the same beat, in all three places at once.

It works for every hazard because every hazard is a number approaching a limit: cm, wet-bulb °C, m/s, AQI.

### Motion

Follow `apple-design` and `emil-design-eng`:

- Respond on **pointer-down**, not release
- Springs for anything gesture-driven; plain CSS transitions for simple fades
- **Every animation interruptible** — animate from the current presentation value, never the target
- 1:1 tracking during drags; the scrubber stays glued to the finger
- `prefers-reduced-motion`: movement drops, opacity survives
- **One orchestrated moment** — the threshold crossing. Everything else stays quiet.

Scattered animation is the clearest tell of AI-generated UI. Cut anything decorative.

### Libraries — from `pick-ui-library`, do not substitute

| Task | Library |
|---|---|
| Animation, springs, gestures | `motion` |
| Accessible primitives | `base-ui` |
| Toasts | `sonner` |
| Animated numbers | `number-flow` |
| Charts | `recharts` |
| Map | `leaflet`, self-hosted tiles |
| 3D | `three` |

---

## 6. The 3D scene

**Real geometry. Not a stylised diorama, not photorealistic tiles.**

OSM building footprints and roads for the ward, extruded to real heights, on real terrain. The actual street layout — actual building shapes, actual positions.

Not Google Photorealistic 3D Tiles: they need billing, an API key and the internet (contradicting offline, and dying on hackathon WiFi), coverage is not guaranteed, and a photogrammetry mesh has trees and cars baked in — push water through it and you get z-fighting. Clean extruded geometry reads *better* for the only question that matters: how deep, against what.

- **~400 m radius** around the household, not the whole city
- Instanced meshes, LOD, capped triangles. Target 60fps on a mid-range phone — profile it
- A **1.72 m figure** for scale (note: three r128 has no `CapsuleGeometry`)
- A **scrubber** for the next few hours. The horizon advances **linearly** — easing the clock compresses hours into the first instant. Smoothness comes from eased transitions on the level, not on time.
- Label on screen: geometry is real OSM data, hazard levels are modelled

### Per-hazard renderers, one interface

| Hazard | Scene |
|---|---|
| Flood | water volume rising against walls, depth marked on the figure |
| Landslide | slope above, debris path downhill through the buildings in its way |
| Fire | spread front advancing across footprints |
| Heat | surface temperature gradient, shade, cool-refuge markers |
| AQI | visibility falloff — the street hazes over |

---

## 7. Build order

**Must ship, deployed, end to end:**
register → personalised risk page → hazard rises → household-specific warning → 3D scene on real geometry → one-tap help request

**Then:** voice intake UI → shelters + routing → second hazard renderer → city dashboard

**Stubbed if the clock wins:** damage claims, alert calibration UI

One thread working end to end beats eight half-built features. Round 2 scores User Experience, Presentation, Feasibility, Implementation and Business Model — four of five reward finished over ambitious.

---

## 8. Working rules

- **Verify by looking, not by reading code.** Screenshot the running app at 390px and desktop. On the previous project, screenshotting immediately surfaced three real defects that source review had missed.
- **After a layout restructure, sweep the stylesheet.** Known failure mode: base rules deleted during restructures leaving orphaned media-query overrides. It happened three times last time.
- **Test at 390px before declaring a screen done.** The previous project shipped a broken phone layout while claiming "works on a phone."
- Commit in small, described steps. The jury may ask to see history.
