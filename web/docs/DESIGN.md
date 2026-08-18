# NAGARANETRA — Design

The authoritative statement of the design system is **CLAUDE.md §5**. This file records
decisions made while building, and the reasons, so any of us can defend them to a jury.

## Where the values live

`web/src/styles/tokens.css` is the single source of colour. Nothing else in the project
contains a hex literal — verified by:

```bash
grep -rn --include='*.ts' --include='*.tsx' --include='*.css' -E '#[0-9A-Fa-f]{6}' web/src \
  | grep -v 'styles/tokens.css'
```

Two exceptions, both deliberate and both derived rather than duplicated:

- `web/index.html` carries `<meta name="theme-color">`, which the browser applies before
  any CSS parses, so it cannot be a variable. It mirrors `--ink`.
- The web app manifest needs literal colours. `web/vite.config.ts` **reads them out of
  tokens.css at build time** rather than copying them.

## Surfaces

Components never read the raw palette. They read the bindings — `--bg`, `--bg-raised`,
`--fg`, `--fg-muted`, `--hairline`, `--action`. `[data-surface="city"]` rebinds those six
and repaints a whole subtree; no component branches on which surface it is on.

## Fonts

Four families, all self-hosted woff2 in `web/public/fonts`, no CDN anywhere (offline is a
product requirement, CLAUDE.md §5). Sources are recorded in `web/src/styles/fonts.css`.

- **Archivo** ships as the two-axis variable font — weight *and* width. The width axis is
  the point: condensed heavy weights are the signage vernacular. `--width-condensed: 75%`.
- **Inter** ships with weight + optical size; `font-optical-sizing: auto` uses it.
- **Noto Sans Malayalam** is confined by `unicode-range` to the Malayalam block, so latin
  in a mixed line still renders in Inter and the Malayalam file only downloads when
  Malayalam is on screen.
- **IBM Plex Mono** has no variable release, so three static weights (400/500/600).

Total font payload: ~296 KB.

## Icons

`web/scripts/make-icons.mjs` generates `favicon.svg`, `icon-192.png` and `icon-512.png`
from the tokens. The mark is the threshold line with the marker above it — the signature
element, so the app icon says what the product is. Regenerate with
`node scripts/make-icons.mjs`; nothing binary in this repo is un-regenerable.

## Still to build

The threshold line component itself, the forecast sparkline, the 3D scene, and the
per-hazard renderers.
