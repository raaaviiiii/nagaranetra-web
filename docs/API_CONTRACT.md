# NAGARANETRA — Backend Brief & API Contract

**For:** backend owner
**From:** frontend
**Status of this document:** the API contract in §6 is **FROZEN**. If it needs to change, it changes by agreement between both of us, and both repos update in the same sitting. A silent change on either side costs us the integration.

Built for: AI Innovation Hackathon 2026, ASIET — Track T5, AI for Smart Cities. 24 hours.

---

## 1. What we are building

One website a city's residents use **before, during and after** a disaster.

A resident registers their household once. From then on, every message the platform gives them is about **their house** — not their district.

### The thesis

Public warnings in India are area-targeted. NDMA's SACHET and cell broadcast push the same sentence to everyone in a district, regardless of whether they live on a ground floor or a third floor, whether anyone in the house can walk, or whether their street floods at 40 cm while the next one floods at 90.

**Nagaranetra knows the household, so the warning is different for every home.** Same rainfall, same zone, different message — because the system knows the floor, the building, and who lives there.

It is **not** a flood app and **not** a Kochi app. Hazards are plug-ins; a city switches on the ones it faces.

---

## 2. Methodology

Four stages. Each is a service.

### Stage 1 — Hazard exposure (zone level)

For each zone in a city, compute exposure over a time horizon given driving conditions.

For **flood**, a physics water balance:

```
accumulation → runoff → soil saturation → drainage → ponding
```

- **Accumulation** — antecedent rainfall included, because a nowcast is issued into weather already in progress. Must scale with intensity, so dry input reads exactly zero, not a floor value.
- **Runoff** — coefficient from zone susceptibility × terrain factor × land cover (urban highest, forest lowest).
- **Soil saturation** — `1 - exp(-cumulative / capacity)`. Clay saturates fastest and therefore floods soonest. This is why depth accelerates rather than tracking rainfall linearly.
- **Drainage** — degrades with canal backup and saturation. Canal proximity directly reduces drainage capacity.
- **Ponding** — elevation-driven pooling multiplier.

For **landslide**, a simpler susceptibility model: slope angle, antecedent rainfall, soil depth, land cover.

**Output must be validated:** monotonic in time, monotonic in intensity, dry reads zero, and levels **staggered across zones** — they must not all cross a threshold at once, or the demo has no drama and no credibility.

### Stage 2 — Household threshold (the product)

Zone exposure is not what the resident needs. **Their** impact time is.

```
household_exposure = zone_exposure × household_modifier(profile)
```

Floor level and building type are the dominant modifiers. A ground floor at 60 cm is in trouble; a third floor at 60 cm is not. Mobility dependencies shift the *lead time* required, not the exposure — someone who needs help evacuating needs the warning earlier.

Return: current level, predicted crossing time, and a recommended action.

**This stage is the entire product claim.** Two households on the same street must get materially different responses.

### Stage 3 — Intake

Free text, or an audio file, or icon selections → a structured, geolocated, categorised assistance request. ASR for Malayalam and English, then intent and urgency extraction.

### Stage 4 — Services on top

Shelters with capacity, route passability, damage assessment from photos.

---

## 3. The hazard plug-in contract

**This abstraction is what makes this a smart-cities platform rather than a flood demo.** Every service is written once against this interface and never learns which hazard it is serving.

If you find yourself writing `if hazard == "flood"` anywhere outside a `hazards/` module, the abstraction is wrong.

```python
class Hazard(Protocol):
    id: str          # "flood" | "landslide" | "heat" | "fire" | "aqi" | "cyclone"
    unit: str        # "cm" | "probability" | "C_wbgt" | "m_s" | "aqi"

    def exposure(self, zone: Zone, conditions: dict, t_minutes: int) -> float: ...
    def bands(self) -> list[Band]: ...                        # exposure → IMD level
    def household_modifier(self, profile: Profile) -> float: ...
    def action(self, level: str, profile: Profile) -> str: ...

    renderer: str    # which 3D renderer the frontend uses
```

City configs switch hazards on:

```json
{ "city": "kochi",   "hazards": ["flood", "fire"],       "zones": "kochi_zones.json" }
{ "city": "wayanad", "hazards": ["landslide", "flood"],  "zones": "wayanad_zones.json" }
```

**Build at least two hazards.** Two shallow hazards prove the architecture better than one deep one. Flood is the deep, validated one; landslide is the proof.

---

## 4. Where the AI is

Be precise about this — an Infosys AI engineer is on the jury and vagueness will be probed.

| Component | Job | Type |
|---|---|---|
| **City hazard profiler** | terrain, land cover, drainage, history → which hazards apply here and each zone's susceptibility | **learned** |
| **Voice / text intake** | Malayalam voice note → structured, geolocated request | **learned** (ASR + intent) |
| **Household thresholds** | zone forecast + floor + building + vulnerability → *your* impact time | physics-led, **learned correction** |
| **Route passability** | which road segments stop being usable, when, for which vehicle | **learned**, spatiotemporal |
| **Damage assessment** | photo → damage type and severity | **learned** (vision) |
| **Alert calibration** | tune per-household thresholds against asymmetric cost | tuning layer |

**The city hazard profiler matters most for the pitch.** It is the answer to "is this just a Kochi project?" — the model derives a new city's hazard profile instead of requiring consultants.

If the clock beats you, damage assessment and alert calibration are declared-and-stubbed. **Never the profiler or the intake.**

**Honesty rule, carried from the last project:** if a model contributes less than you'd like, say so with numbers rather than overselling. Volunteering a measured limitation reads as engineering maturity; being caught on it reads as overselling.

---

## 5. Two critical deployment decisions

### 5.1 Precompute the hazard layer to static JSON

**A cold-starting free-tier backend in front of a jury is a project-ending moment.**

So the thing the demo depends on must never touch a server at demo time. Write a script that runs the full grid of scenarios and emits static JSON, which the frontend commits and serves from its CDN.

```
scripts/precompute.py  →  web/public/data/scenarios/{city}_{hazard}_{intensity}.json
```

This buys instant response, zero cost, and offline caching for free.

The live API then only handles what must be dynamic: profiles, requests, intake, shelters.

### 5.2 Do not deploy to a sleeping free tier

Render's free tier idles after ~15 minutes and takes the better part of a minute to wake — which is exactly what happens between setup and the jury walking over. **Use Fly.io or Railway.** Verify cold response time from a fresh browser before calling it deployed.

CORS must allow the frontend's deployed origin.

---

## 6. THE API CONTRACT — FROZEN

The frontend implements a deterministic mock of every one of these before the backend exists, and develops against it. **Field names, shapes and enums must match exactly.** A field can degrade; a field cannot be renamed.

### Shared enums

```
level:       "none" | "watch" | "alert" | "warning"     (IMD ladder)
trend:       "rising" | "steady" | "falling"
building:    "independent" | "apartment" | "row" | "hut" | "commercial"
urgency:     "routine" | "urgent" | "critical"
```

### `GET /health`

```json
{ "status": "ok", "version": "0.1.0", "hazards": ["flood", "landslide"], "cities": ["kochi"] }
```

### `GET /cities/{city}`

```json
{
  "id": "kochi",
  "name": "Kochi",
  "hazards": ["flood", "fire"],
  "center": { "lat": 9.9816, "lng": 76.2999 },
  "zones": [
    { "id": "kaloor", "name": "Kaloor", "name_ml": "കലൂർ",
      "lat": 9.997, "lng": 76.299, "population": 42000 }
  ]
}
```

### `GET /forecast?city=&hazard=&intensity=`

The main read. Returns **all time offsets in one response** so the frontend can scrub without re-fetching.

```json
{
  "generatedAt": "2026-08-18T10:00:00Z",
  "city": "kochi",
  "hazard": "flood",
  "unit": "cm",
  "intensity": 62,
  "source": "model",
  "bands": [
    { "level": "none",    "min": 0,  "max": 10 },
    { "level": "watch",   "min": 10, "max": 25 },
    { "level": "alert",   "min": 25, "max": 50 },
    { "level": "warning", "min": 50, "max": null }
  ],
  "frames": [
    {
      "offsetMin": 0,
      "zones": [
        { "id": "kaloor", "exposure": 13.1, "level": "watch",
          "risk": 0.17, "trend": "rising" }
      ]
    }
  ]
}
```

`source` is `"model"` or `"fallback"`. The frontend displays this to the user — it must be accurate.

### `POST /household/threshold`

The product. Zone forecast + profile → this household's answer.

```json
// request
{
  "city": "kochi",
  "zoneId": "kaloor",
  "hazard": "flood",
  "intensity": 62,
  "profile": {
    "buildingType": "independent",
    "floorLevel": 0,
    "householdSize": 4,
    "hasElderly": true,
    "hasLimitedMobility": true,
    "hasVehicle": false,
    "language": "ml"
  }
}
```

```json
// response
{
  "level": "alert",
  "exposure": 34.2,
  "unit": "cm",
  "threshold": 30,
  "crossesAtMin": 45,
  "leadTimeMin": 90,
  "action": "Move to a higher floor now.",
  "action_ml": "ഇപ്പോൾ മുകളിലത്തെ നിലയിലേക്ക് മാറുക.",
  "reasons": [
    "Ground floor",
    "Someone in the house needs help to move",
    "No vehicle available"
  ]
}
```

`threshold` is this household's limit — the frontend draws it as the signature threshold line. `reasons` are shown verbatim; write them in plain language, from the resident's side of the screen.

### `POST /requests`

No auth. Must accept a request with almost nothing filled in.

```json
// request
{
  "type": "rescue" | "medical" | "supplies" | "shelter" | "other",
  "urgency": "urgent",
  "lat": 9.997, "lng": 76.299,
  "text": "optional free text",
  "profileId": "optional",
  "createdAt": "2026-08-18T10:00:00Z",
  "clientId": "uuid-generated-offline"
}
```

```json
// response
{ "id": "req_01H...", "status": "received", "clientId": "uuid-generated-offline" }
```

`clientId` is generated offline by the frontend and echoed back, so a queued request replayed twice does not create a duplicate. **Make this idempotent** — offline sync will retry.

### `POST /intake/voice`

`multipart/form-data`: `audio` file, optional `lat`, `lng`, `lang`.

```json
{
  "transcript": "…",
  "language": "ml",
  "structured": { "type": "rescue", "urgency": "critical", "peopleCount": 3 }
}
```

### `GET /shelters?city=&lat=&lng=`

```json
{
  "shelters": [
    { "id": "s1", "name": "Govt. HSS Kaloor", "lat": 9.998, "lng": 76.300,
      "capacity": 300, "occupancy": 145, "open": true, "distanceM": 420 }
  ]
}
```

### `GET /nearby?lat=&lng=`

```json
{
  "services": [
    { "type": "hospital" | "fire" | "police" | "shelter",
      "name": "…", "lat": 0, "lng": 0, "phone": "…", "distanceM": 800 }
  ]
}
```

### Error shape — same for every endpoint

```json
{ "error": { "code": "invalid_zone", "message": "Unknown zone id" } }
```

---

## 7. Build order

1. `/health`, `/cities/{city}` — unblocks the frontend immediately
2. Hazard plug-in base + flood model + validation tests
3. `/forecast` + the precompute script
4. `/household/threshold` ← **the product; do not deprioritise this**
5. `/requests` (idempotent)
6. Second hazard — landslide
7. `/nearby`, `/shelters`
8. `/intake/voice`
9. Deploy to Fly.io or Railway, CORS open to the frontend origin

**Ship `/health` and `/cities` first**, even returning stubs. It unblocks integration hours earlier than a perfect model does.

---

## 8. Rules we are both held to

- **Never claim the system dispatches emergency services.** We notify and match; a human authority acts.
- **Label simulated data as simulated** — that is why `source` is in the forecast payload.
- **Validate before committing a model.** Monotonic in time, monotonic in intensity, dry reads zero, levels staggered across zones. Write it as a test file, not a one-off script.
- **We must be able to explain every line.** The rules penalise auto-generated code the team cannot explain. Comment the physics.
- Commit in small, described steps. The jury may ask to see history.
