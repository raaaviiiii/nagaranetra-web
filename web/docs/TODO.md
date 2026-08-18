# Deferred work

Things consciously left for later, with the reason and the prompt they belong to. An item
here is a decision to defer, not a thing we forgot.

## Prompt 8 — Malayalam review

- [ ] **Malayalam runs optically larger than Latin at the same `font-size`.** Noto Sans
      Malayalam has a larger glyph body relative to its em than Inter, so a mixed line or a
      side-by-side pair looks unbalanced — most visible at `--size-display` and
      `--size-status` on `/styleguide` §1. Fix with `font-size-adjust` on the Malayalam
      face, or a per-script scale factor applied wherever `--font-mal` is used. Measure it
      against the specimen sheet rather than by eye alone.
- [ ] **Every Malayalam string needs a native speaker's review.** One action string is
      verbatim from `API_CONTRACT.md`; the rest were written by us. They shape correctly,
      which is not the same as reading right to a resident under stress. Strings live in
      `src/lib/mock.ts` (hazard actions) and `src/routes/styleguide.tsx` (specimens).

## Needs the backend owner's agreement

- [ ] **Landslide bands are the frontend's proposal.** The contract fixes flood's bands by
      example but is silent on a 0–1 probability. We use none 0–0.2, watch 0.2–0.4,
      alert 0.4–0.65, warning 0.65+. If the backend picks different cut-points, the two
      repos will colour the same number differently.
- [ ] **The contract is internally inconsistent about Kochi's hazards.** `/health` lists
      `["flood","landslide"]`; the `/cities/kochi` example lists `["flood","fire"]`. We
      follow §3 and §7, which both name landslide as the second hazard. Fire is not
      modelled.

## Housekeeping

- [ ] **README links to the API repo with a `TODO`.** Nothing under the account looks like
      the backend and the contract does not name it. One-line change once the URL exists.
