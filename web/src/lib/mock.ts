/**
 * Deterministic in-browser implementation of the ENTIRE frozen contract (docs/API_CONTRACT.md §6).
 *
 * Why this file exists (CLAUDE.md §3): the backend may be late, broken or unreachable at any
 * moment tonight. Every screen is developed against this module, and the live API is switched
 * in by changing one flag. The demo must run with the backend switched off entirely.
 *
 * DETERMINISM IS A HARD RULE. Same inputs -> byte-identical outputs, every time:
 *   - no Math.random anywhere. Per-zone variation comes from a hash of the zone id.
 *   - no Date.now in any returned value. `generatedAt` is a fixed scenario epoch, so a
 *     demo run at 03:00 and a demo run in front of the jury show the same numbers.
 *   - no I/O. Pure functions, so `mock.test.ts` can check the model properties directly.
 *
 * WHAT IS MODELLED VS WHAT IS REAL. Everything here is modelled, and the app labels it
 * `Simulated` on the face of the product. The physics below follows the shape of the model
 * described in contract §2 (accumulation -> runoff -> soil saturation -> drainage -> ponding)
 * at demo fidelity. It is not a validated hydrological model, and we do not claim it is.
 *
 * The four validation properties from contract §8 hold, and are asserted in mock.test.ts:
 *   1. monotonic in time      2. monotonic in intensity
 *   3. dry input reads exactly zero                4. levels staggered across zones
 */
import type {
  Band,
  City,
  Forecast,
  Frame,
  HazardId,
  HazardUnit,
  Health,
  HelpRequest,
  HelpRequestAck,
  IntakeResult,
  Level,
  NearbyResponse,
  Profile,
  SheltersResponse,
  ThresholdRequest,
  ThresholdResponse,
  Trend,
  Zone,
  ZoneFrame,
} from './contract';

/* ------------------------------------------------------------------------------------ */
/* Determinism primitives                                                                */
/* ------------------------------------------------------------------------------------ */

/** FNV-1a. A stable 32-bit hash, so "variation per zone" is reproducible, not random. */
function hash32(input: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

/** Stable value in [0, 1) derived from a string. Replaces Math.random entirely. */
function unit(seed: string): number {
  return hash32(seed) / 0x100000000;
}

/**
 * The scenario clock. Fixed on purpose: `generatedAt` is part of the payload, and a
 * timestamp that moved would make two demo runs differ. Matches the contract's example.
 */
export const SCENARIO_EPOCH = '2026-08-18T10:00:00Z';

/** 6 hours ahead in 15-minute steps — the scrubber's whole range, in one response. */
const HORIZON_MIN = 360;
const STEP_MIN = 15;

/* ------------------------------------------------------------------------------------ */
/* The city and its zones                                                                */
/* ------------------------------------------------------------------------------------ */

/**
 * Zone parameters for the hazard models. These are DEMO PARAMETERS, not survey data:
 * coordinates are approximate ward centres, and susceptibility/drainage/slope are chosen
 * to produce a staggered, legible scenario. The real table comes from the backend's city
 * hazard profiler (contract §4) and replaces this wholesale.
 */
type ZoneModel = Zone & {
  /** Runoff coefficient driver, 0..1. Urban and low-lying is higher. */
  susceptibility: number;
  /** Soil storage before saturation, in mm. Clay is low, so clay floods soonest. */
  soilCapacityMm: number;
  /** Drainage capacity in mm/h when the system is clear. */
  drainageMmH: number;
  /** How much the drain is already backed up, 0..1. Canal-adjacent zones are worse. */
  canalBackup: number;
  /** Ponding multiplier from elevation — low ground pools deeper. */
  ponding: number;
  /** Hours of rain already fallen before the nowcast is issued (contract §2). */
  antecedentH: number;
  /** Mean slope in degrees, for the landslide model. */
  slopeDeg: number;
  /** Depth of mobilisable soil in mm, for the landslide model. */
  soilDepthMm: number;
};

const KOCHI_ZONES: ZoneModel[] = [
  { id: 'kaloor', name: 'Kaloor', name_ml: 'കലൂർ', lat: 9.997, lng: 76.299, population: 42000,
    susceptibility: 0.78, soilCapacityMm: 60, drainageMmH: 18, canalBackup: 0.35, ponding: 1.10, antecedentH: 3.0, slopeDeg: 2, soilDepthMm: 900 },
  { id: 'vyttila', name: 'Vyttila', name_ml: 'വൈറ്റില', lat: 9.968, lng: 76.318, population: 38000,
    susceptibility: 0.84, soilCapacityMm: 52, drainageMmH: 15, canalBackup: 0.48, ponding: 1.22, antecedentH: 3.4, slopeDeg: 2, soilDepthMm: 850 },
  { id: 'edappally', name: 'Edappally', name_ml: 'ഇടപ്പള്ളി', lat: 10.026, lng: 76.308, population: 45000,
    susceptibility: 0.70, soilCapacityMm: 72, drainageMmH: 22, canalBackup: 0.22, ponding: 0.96, antecedentH: 2.6, slopeDeg: 3, soilDepthMm: 1000 },
  { id: 'palarivattom', name: 'Palarivattom', name_ml: 'പാലാരിവട്ടം', lat: 10.006, lng: 76.310, population: 31000,
    susceptibility: 0.74, soilCapacityMm: 66, drainageMmH: 20, canalBackup: 0.28, ponding: 1.02, antecedentH: 2.8, slopeDeg: 3, soilDepthMm: 950 },
  { id: 'kadavanthra', name: 'Kadavanthra', name_ml: 'കടവന്ത്ര', lat: 9.968, lng: 76.298, population: 27000,
    susceptibility: 0.80, soilCapacityMm: 58, drainageMmH: 17, canalBackup: 0.40, ponding: 1.14, antecedentH: 3.1, slopeDeg: 2, soilDepthMm: 880 },
  { id: 'panampilly', name: 'Panampilly Nagar', name_ml: 'പനമ്പിള്ളി നഗർ', lat: 9.957, lng: 76.297, population: 22000,
    susceptibility: 0.66, soilCapacityMm: 78, drainageMmH: 24, canalBackup: 0.18, ponding: 0.90, antecedentH: 2.4, slopeDeg: 2, soilDepthMm: 1000 },
  { id: 'thevara', name: 'Thevara', name_ml: 'തേവര', lat: 9.938, lng: 76.298, population: 25000,
    susceptibility: 0.72, soilCapacityMm: 68, drainageMmH: 19, canalBackup: 0.30, ponding: 1.05, antecedentH: 2.9, slopeDeg: 2, soilDepthMm: 920 },
  { id: 'fortkochi', name: 'Fort Kochi', name_ml: 'ഫോർട്ട് കൊച്ചി', lat: 9.965, lng: 76.242, population: 20000,
    susceptibility: 0.62, soilCapacityMm: 84, drainageMmH: 26, canalBackup: 0.15, ponding: 0.86, antecedentH: 2.2, slopeDeg: 1, soilDepthMm: 1000 },
  { id: 'mattancherry', name: 'Mattancherry', name_ml: 'മട്ടാഞ്ചേരി', lat: 9.958, lng: 76.259, population: 34000,
    susceptibility: 0.76, soilCapacityMm: 64, drainageMmH: 16, canalBackup: 0.38, ponding: 1.08, antecedentH: 3.0, slopeDeg: 1, soilDepthMm: 900 },
  { id: 'elamkulam', name: 'Elamkulam', name_ml: 'ഇളംകുളം', lat: 9.972, lng: 76.306, population: 29000,
    susceptibility: 0.88, soilCapacityMm: 48, drainageMmH: 14, canalBackup: 0.52, ponding: 1.28, antecedentH: 3.6, slopeDeg: 2, soilDepthMm: 800 },
];


/**
 * Wayanad. Hill district: steep slopes, deep soil, and the landslide hazard switched on.
 *
 * It is here because a hazard plug-in that only ever reads zero proves nothing. Kochi is
 * flat, so its landslide exposure is correctly ~0 — which is the city hazard profiler's
 * whole point (contract §4), but it makes for no scene. Wayanad gives the second renderer
 * something real to draw, and matches the city config in contract §3 verbatim:
 *   { "city": "wayanad", "hazards": ["landslide", "flood"], "zones": "wayanad_zones.json" }
 *
 * Real geography, placeholder names: the coordinates and the terrain parameters are the
 * district's, the ward names are not. Simulating a fresh disaster onto the names of real
 * places — some of which lost people in 2024 — is not a default to take casually. Naming
 * is a decision for the pitch, made deliberately, not a side effect of writing fixtures.
 */
const WAYANAD_ZONES: ZoneModel[] = [
  { id: 'ward-1', name: 'Wayanad Ward 1', name_ml: 'വയനാട് വാർഡ് 1', lat: 11.607, lng: 76.083, population: 31000,
    susceptibility: 0.58, soilCapacityMm: 90, drainageMmH: 26, canalBackup: 0.10, ponding: 0.80, antecedentH: 3.2, slopeDeg: 14, soilDepthMm: 1400 },
  { id: 'ward-2', name: 'Wayanad Ward 2', name_ml: 'വയനാട് വാർഡ് 2', lat: 11.551, lng: 76.038, population: 12000,
    susceptibility: 0.54, soilCapacityMm: 96, drainageMmH: 28, canalBackup: 0.08, ponding: 0.74, antecedentH: 3.6, slopeDeg: 27, soilDepthMm: 1600 },
  { id: 'demo-landslide', name: 'Demo Landslide Zone', name_ml: 'ഡെമോ ഉരുൾപൊട്ടൽ മേഖല', lat: 11.548, lng: 76.135, population: 18000,
    susceptibility: 0.56, soilCapacityMm: 92, drainageMmH: 27, canalBackup: 0.09, ponding: 0.78, antecedentH: 3.8, slopeDeg: 31, soilDepthMm: 1750 },
  { id: 'ward-3', name: 'Wayanad Ward 3', name_ml: 'വയനാട് വാർഡ് 3', lat: 11.622, lng: 76.207, population: 21000,
    susceptibility: 0.52, soilCapacityMm: 98, drainageMmH: 29, canalBackup: 0.07, ponding: 0.72, antecedentH: 3.0, slopeDeg: 19, soilDepthMm: 1500 },
  { id: 'ward-4', name: 'Wayanad Ward 4', name_ml: 'വയനാട് വാർഡ് 4', lat: 11.664, lng: 76.261, population: 26000,
    susceptibility: 0.50, soilCapacityMm: 102, drainageMmH: 30, canalBackup: 0.06, ponding: 0.70, antecedentH: 2.8, slopeDeg: 9, soilDepthMm: 1300 },
  { id: 'ward-5', name: 'Wayanad Ward 5', name_ml: 'വയനാട് വാർഡ് 5', lat: 11.801, lng: 76.004, population: 24000,
    susceptibility: 0.55, soilCapacityMm: 94, drainageMmH: 27, canalBackup: 0.09, ponding: 0.76, antecedentH: 3.1, slopeDeg: 12, soilDepthMm: 1350 },
  { id: 'ward-6', name: 'Wayanad Ward 6', name_ml: 'വയനാട് വാർഡ് 6', lat: 11.618, lng: 75.990, population: 9000,
    susceptibility: 0.53, soilCapacityMm: 97, drainageMmH: 28, canalBackup: 0.07, ponding: 0.73, antecedentH: 3.5, slopeDeg: 23, soilDepthMm: 1550 },
  { id: 'ward-7', name: 'Wayanad Ward 7', name_ml: 'വയനാട് വാർഡ് 7', lat: 11.700, lng: 75.976, population: 14000,
    susceptibility: 0.57, soilCapacityMm: 93, drainageMmH: 26, canalBackup: 0.11, ponding: 0.79, antecedentH: 3.3, slopeDeg: 17, soilDepthMm: 1450 },
];

/** Cities the mock can serve, each with its own hazards switched on. */
const CITIES: Record<string, { name: string; hazards: HazardId[]; center: { lat: number; lng: number }; zones: ZoneModel[] }> = {
  kochi: {
    name: 'Kochi',
    // Coastal and flat: flood only. Switching landslide on here would be dishonest —
    // the model correctly reads ~0 on this terrain, and a hazard a city does not face
    // is a hazard a city should not be shown.
    hazards: ['flood'],
    center: { lat: 9.9816, lng: 76.2999 },
    zones: KOCHI_ZONES,
  },
  wayanad: {
    name: 'Wayanad',
    // Contract §3, verbatim: { "city": "wayanad", "hazards": ["landslide", "flood"] }.
    hazards: ['landslide', 'flood'],
    center: { lat: 11.685, lng: 76.132 },
    zones: WAYANAD_ZONES,
  },
};

export const DEFAULT_CITY = 'kochi';
export const DEFAULT_ZONE = 'kaloor';

/* ------------------------------------------------------------------------------------ */
/* The hazard plug-ins                                                                    */
/* ------------------------------------------------------------------------------------ */

/**
 * One interface, every hazard behind it (contract §3). Nothing outside this section is
 * allowed to ask which hazard it is serving.
 */
type HazardModel = {
  id: HazardId;
  unit: HazardUnit;
  bands: Band[];
  /** Zone exposure in `unit`, for a rain intensity in mm/h at t minutes ahead. */
  exposure(zone: ZoneModel, intensityMmH: number, tMin: number): number;
  /** Exposure -> 0..1 risk. Monotone, so the two never disagree. */
  risk(exposure: number): number;
  /** How much of the zone exposure this household actually gets (contract §2, stage 2). */
  householdModifier(exposure: number, profile: Profile): number;
  /** This household's limit, in `unit`. Drawn as the threshold line. */
  threshold(profile: Profile): number;
  /** What this household should do, in English and Malayalam. */
  action(level: Level, profile: Profile): { en: string; ml: string };
  /** Which 3D renderer the frontend uses (contract §3). */
  renderer: string;
};

/**
 * Rain that has already fallen plus rain still to come, in mm.
 * Scales with intensity so that dry input reads EXACTLY zero (contract §2) — the
 * antecedent term is a multiple of intensity, never a constant floor.
 */
function accumulationMm(zone: ZoneModel, intensityMmH: number, tMin: number): number {
  return intensityMmH * (zone.antecedentH + tMin / 60);
}

/** Soil saturation, 0..1. Clay (low capacity) saturates fastest and so floods soonest. */
function saturation(cumulativeMm: number, capacityMm: number): number {
  return 1 - Math.exp(-cumulativeMm / capacityMm);
}

const FLOOD: HazardModel = {
  id: 'flood',
  unit: 'cm',
  // Bands are given verbatim in the contract's /forecast example.
  bands: [
    { level: 'none', min: 0, max: 10 },
    { level: 'watch', min: 10, max: 25 },
    { level: 'alert', min: 25, max: 50 },
    { level: 'warning', min: 50, max: null },
  ],

  /**
   * Water balance, at demo fidelity: accumulation -> runoff -> saturation -> drainage -> ponding.
   *
   * Depth accelerates rather than tracking rainfall, because the saturation term rises
   * with the rain already absorbed — that is the behaviour the product exists to warn about.
   */
  exposure(zone, intensityMmH, tMin) {
    if (intensityMmH <= 0) return 0; // dry reads exactly zero

    const cumulative = accumulationMm(zone, intensityMmH, tMin);
    const s = saturation(cumulative, zone.soilCapacityMm);

    // Runoff: the fraction of rain that does not soak away. Rises with saturation.
    const runoffMm = cumulative * zone.susceptibility * (0.55 + 0.45 * s);

    // Drainage: degrades with canal backup and with saturation (contract §2).
    const drainRate = zone.drainageMmH * (1 - 0.6 * s) * (1 - zone.canalBackup);
    const drainedMm = drainRate * (zone.antecedentH + tMin / 60);

    // Ponding: what is left pools by elevation. 10 mm of retained water -> 1 cm of depth.
    const depthCm = Math.max(0, (runoffMm - drainedMm) / 10) * zone.ponding;
    return round1(depthCm);
  },

  // Monotone in exposure and asymptotic to 1. 70 cm is the scale at which we call it certain.
  risk: (exposure) => round2(1 - Math.exp(-exposure / 70)),

  /**
   * Floor level is the dominant modifier, and it is the whole thesis: a ground floor at
   * 60 cm is in trouble, a third floor at 60 cm is not. Water above a floor is water that
   * simply does not reach that household.
   *
   * Returned as a MULTIPLIER because the contract defines stage 2 as
   * `household_exposure = zone_exposure x household_modifier(profile)`.
   */
  householdModifier(exposure, profile) {
    if (exposure <= 0) return 0;
    const FLOOR_HEIGHT_CM = 300;
    const reaching = Math.max(0, exposure - profile.floorLevel * FLOOR_HEIGHT_CM);
    // Building vulnerability: a hut takes the same water worse than a concrete frame.
    const byBuilding: Record<Profile['buildingType'], number> = {
      hut: 1.25,
      row: 1.05,
      independent: 1.0,
      commercial: 0.95,
      apartment: 0.9,
    };
    return (reaching / exposure) * byBuilding[profile.buildingType];
  },

  /** Where THIS house is in trouble. Contract example: independent, ground floor -> 30 cm. */
  threshold(profile) {
    const byBuilding: Record<Profile['buildingType'], number> = {
      hut: 15,
      independent: 30,
      row: 30,
      commercial: 35,
      apartment: 40,
    };
    return byBuilding[profile.buildingType];
  },

  action(level, profile) {
    const onGround = profile.floorLevel === 0;
    const needsHelp = profile.hasLimitedMobility && !profile.hasVehicle;
    if (level === 'none')
      return { en: 'No action needed. Water is not expected to reach your house.', ml: 'ഇപ്പോൾ നടപടി വേണ്ട. വീട്ടിൽ വെള്ളം കയറില്ല.' };
    if (level === 'watch')
      return { en: 'Move documents and valuables above knee height.', ml: 'രേഖകളും വിലപിടിപ്പുള്ളവയും ഉയരത്തിൽ വയ്ക്കുക.' };
    if (level === 'alert')
      return onGround
        // Verbatim from the contract's /household/threshold example.
        ? { en: 'Move to a higher floor now.', ml: 'ഇപ്പോൾ മുകളിലത്തെ നിലയിലേക്ക് മാറുക.' }
        : { en: 'Stay where you are. Do not use the stairwell if water is in it.', ml: 'ഇവിടെത്തന്നെ തുടരുക. വെള്ളമുള്ള കോണിപ്പടി ഉപയോഗിക്കരുത്.' };
    return needsHelp
      ? { en: 'Ask for help now — you may not be able to leave on your own.', ml: 'ഇപ്പോൾ തന്നെ സഹായം ആവശ്യപ്പെടുക.' }
      : { en: 'Leave for a shelter now, before the road is cut.', ml: 'റോഡ് മുറിയുന്നതിനു മുൻപ് ഇപ്പോൾ ഷെൽട്ടറിലേക്ക് മാറുക.' };
  },

  renderer: 'flood',
};

const LANDSLIDE: HazardModel = {
  id: 'landslide',
  unit: 'probability',
  /**
   * The contract fixes the flood bands by example but does not state landslide bands, so
   * these are the frontend's proposal for a 0..1 probability. FLAGGED for agreement with
   * the backend before integration.
   */
  bands: [
    { level: 'none', min: 0, max: 0.2 },
    { level: 'watch', min: 0.2, max: 0.4 },
    { level: 'alert', min: 0.4, max: 0.65 },
    { level: 'warning', min: 0.65, max: null },
  ],

  /** Susceptibility model: slope angle, antecedent rainfall, soil depth, land cover (contract §2). */
  exposure(zone, intensityMmH, tMin) {
    if (intensityMmH <= 0) return 0;
    const cumulative = accumulationMm(zone, intensityMmH, tMin);
    // Steeper slopes mobilise with less water. Below ~5 degrees, almost nothing happens.
    const slopeFactor = Math.max(0, (zone.slopeDeg - 1) / 25);
    const wetness = cumulative / zone.soilDepthMm;
    // 3.0 is the coupling constant: tuned so a 30-degree slope with deep soil walks
    // watch -> alert -> warning across the 6-hour horizon, while gentle ground stays
    // where it belongs. Deep soil holds more water, so it needs more rain to mobilise.
    return round2(1 - Math.exp(-wetness * slopeFactor * 3.0));
  },

  risk: (exposure) => round2(exposure),

  /** A hut on a slope is the exposed case; upper floors do not help against debris. */
  householdModifier(_exposure, profile) {
    const byBuilding: Record<Profile['buildingType'], number> = {
      hut: 1.3,
      row: 1.1,
      independent: 1.0,
      commercial: 0.95,
      apartment: 0.85,
    };
    return byBuilding[profile.buildingType];
  },

  threshold: () => 0.4,

  action(level, profile) {
    if (level === 'none') return { en: 'No action needed.', ml: 'ഇപ്പോൾ നടപടി വേണ്ട.' };
    if (level === 'watch')
      return { en: 'Watch the slope above the house for new cracks or muddy water.', ml: 'വീടിന് മുകളിലുള്ള ചരിവിൽ വിള്ളലോ ചെളിവെള്ളമോ ശ്രദ്ധിക്കുക.' };
    if (level === 'alert')
      return { en: 'Move away from the slope side of the house.', ml: 'വീടിന്റെ ചരിവുഭാഗത്തുനിന്ന് മാറി നിൽക്കുക.' };
    return profile.hasLimitedMobility
      ? { en: 'Ask for help now — leave for level ground.', ml: 'ഇപ്പോൾ സഹായം ആവശ്യപ്പെടുക — നിരപ്പായ സ്ഥലത്തേക്ക് മാറുക.' }
      : { en: 'Leave the house now and move to level ground.', ml: 'ഇപ്പോൾ വീട് വിട്ട് നിരപ്പായ സ്ഥലത്തേക്ക് മാറുക.' };
  },

  renderer: 'landslide',
};

const HAZARDS: Record<string, HazardModel> = { flood: FLOOD, landslide: LANDSLIDE };

/** Nothing outside this module resolves a hazard id. */
function hazardOr404(id: string): HazardModel {
  const hazard = HAZARDS[id];
  if (!hazard) throw new MockError('unknown_hazard', `Unknown hazard ${id}`);
  return hazard;
}

/* ------------------------------------------------------------------------------------ */
/* Shared helpers                                                                         */
/* ------------------------------------------------------------------------------------ */

/** The contract's error shape, thrown so api.ts can render it the same as a live error. */
export class MockError extends Error {
  /** Matches the `error.code` field of the contract's error shape. */
  code: string;

  constructor(code: string, message: string) {
    super(message);
    this.name = 'MockError';
    this.code = code;
  }
}

const round1 = (n: number) => Math.round(n * 10) / 10;
const round2 = (n: number) => Math.round(n * 100) / 100;

/** Exposure -> IMD level, using the hazard's own bands. Top band has max: null. */
export function levelFor(bands: Band[], exposure: number): Level {
  for (const band of bands) {
    if (exposure >= band.min && (band.max === null || exposure < band.max)) return band.level;
  }
  return bands[bands.length - 1].level;
}

/** Metres between two points. Equirectangular is plenty at ward scale and is cheap. */
export function distanceM(a: { lat: number; lng: number }, b: { lat: number; lng: number }): number {
  const R = 6371000;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = (((b.lng - a.lng) * Math.PI) / 180) * Math.cos(((a.lat + b.lat) / 2 * Math.PI) / 180);
  return Math.round(Math.sqrt(dLat * dLat + dLng * dLng) * R);
}

function cityOr404(id: string) {
  const city = CITIES[id];
  if (!city) throw new MockError('unknown_city', `Unknown city ${id}`);
  return city;
}

/* ------------------------------------------------------------------------------------ */
/* The endpoints — one function per contract §6 entry                                     */
/* ------------------------------------------------------------------------------------ */

/** The bands a hazard uses. Exported so api.ts can re-derive a level when a live payload
 *  arrives with no usable bands of its own. */
export function levelBands(hazardId: string): Band[] {
  return hazardOr404(hazardId).bands;
}

/** GET /health */
export function health(): Health {
  return {
    status: 'ok',
    version: '0.1.0-mock',
    hazards: Object.keys(HAZARDS) as HazardId[],
    cities: Object.keys(CITIES),
  };
}

/** GET /cities/{city} */
export function city(id: string): City {
  const found = cityOr404(id);
  return {
    id,
    name: found.name,
    hazards: found.hazards,
    center: found.center,
    // Strip the model parameters: the contract's Zone has no physics in it.
    zones: found.zones.map(({ id: zid, name, name_ml, lat, lng, population }) => ({
      id: zid, name, name_ml, lat, lng, population,
    })),
  };
}

/** GET /forecast?city=&hazard=&intensity= — every offset in one response. */
export function forecast(params: { city: string; hazard: string; intensity: number }): Forecast {
  const found = cityOr404(params.city);
  const hazard = hazardOr404(params.hazard);
  const intensity = Math.max(0, params.intensity);

  const offsets: number[] = [];
  for (let t = 0; t <= HORIZON_MIN; t += STEP_MIN) offsets.push(t);

  // Exposure for every zone at every offset, computed once so trend can look ahead.
  const grid = new Map<string, number[]>();
  for (const zone of found.zones) {
    grid.set(zone.id, offsets.map((t) => hazard.exposure(zone, intensity, t)));
  }

  const frames: Frame[] = offsets.map((offsetMin, i) => ({
    offsetMin,
    zones: found.zones.map((zone): ZoneFrame => {
      const series = grid.get(zone.id)!;
      const exposure = series[i];
      return {
        id: zone.id,
        exposure,
        level: levelFor(hazard.bands, exposure),
        risk: hazard.risk(exposure),
        trend: trendAt(series, i),
      };
    }),
  }));

  return {
    generatedAt: SCENARIO_EPOCH,
    city: params.city,
    hazard: hazard.id,
    unit: hazard.unit,
    intensity,
    // Honest: this IS the fallback path. api.ts never overwrites it.
    source: 'fallback',
    bands: hazard.bands,
    frames,
  };
}

/** Rising / steady / falling, from the neighbouring samples. */
function trendAt(series: number[], i: number): Trend {
  const previous = series[Math.max(0, i - 1)];
  const next = series[Math.min(series.length - 1, i + 1)];
  const delta = next - previous;
  if (delta > 0.05) return 'rising';
  if (delta < -0.05) return 'falling';
  return 'steady';
}

/**
 * POST /household/threshold — the product.
 *
 * Two households on the same street must get materially different answers, and here is
 * where that happens: the same zone forecast goes through the household modifier, the
 * household's own threshold, and a lead time that grows with who lives in the house.
 */
export function threshold(body: ThresholdRequest): ThresholdResponse {
  const found = cityOr404(body.city);
  const hazard = hazardOr404(body.hazard);
  const zone = found.zones.find((z) => z.id === body.zoneId);
  if (!zone) throw new MockError('invalid_zone', 'Unknown zone id');

  const profile = body.profile;
  const limit = hazard.threshold(profile);

  /** This household's exposure at t minutes ahead. */
  const householdAt = (t: number) => {
    const zoneExposure = hazard.exposure(zone, Math.max(0, body.intensity), t);
    return zoneExposure * hazard.householdModifier(zoneExposure, profile);
  };

  const now = householdAt(0);

  // When does it cross? Walk the same grid the forecast publishes, so the number on the
  // status card and the marker in the 3D scene cannot disagree.
  let crossesAtMin: number | null = null;
  for (let t = 0; t <= HORIZON_MIN; t += STEP_MIN) {
    if (householdAt(t) >= limit) {
      crossesAtMin = t;
      break;
    }
  }

  const level = levelFor(hazard.bands, now);
  const copy = hazard.action(level, profile);

  return {
    level,
    exposure: hazard.unit === 'probability' ? round2(now) : round1(now),
    unit: hazard.unit,
    threshold: limit,
    crossesAtMin,
    leadTimeMin: leadTimeFor(profile),
    action: copy.en,
    action_ml: copy.ml,
    reasons: reasonsFor(profile),
  };
}

/**
 * Minutes this household needs before impact. Dependencies shift the LEAD TIME, not the
 * exposure (contract §2, stage 2) — someone who needs help evacuating needs warning earlier.
 *
 * The contract's worked example (elderly + limited mobility + no vehicle, household of 4)
 * gives 90, and these terms reproduce it exactly: 30 + 15 + 30 + 15.
 */
function leadTimeFor(profile: Profile): number {
  let minutes = 30;
  if (profile.hasElderly) minutes += 15;
  if (profile.hasLimitedMobility) minutes += 30;
  if (!profile.hasVehicle) minutes += 15;
  minutes += Math.max(0, profile.householdSize - 4) * 5;
  return minutes;
}

/**
 * Why this household got this answer. Shown verbatim, in plain language, from the
 * resident's side of the screen — so each line has to be a fact they recognise about
 * their own house.
 */
function reasonsFor(profile: Profile): string[] {
  const reasons: string[] = [];
  if (profile.floorLevel === 0) reasons.push('Ground floor');
  else reasons.push(`Floor ${profile.floorLevel} — above the expected water`);
  if (profile.buildingType === 'hut') reasons.push('Light or temporary structure');
  if (profile.hasLimitedMobility) reasons.push('Someone in the house needs help to move');
  // Elderly is folded into the line above when both are true, so the list stays short and
  // every line earns its place. This reproduces the contract's example exactly.
  else if (profile.hasElderly) reasons.push('Someone elderly in the house');
  if (!profile.hasVehicle) reasons.push('No vehicle available');
  return reasons;
}

/**
 * POST /requests — no auth, accepts almost nothing filled in.
 * Idempotent: the id is derived from the clientId, so replaying a queued request returns
 * the same id instead of creating a second one.
 */
export function createRequest(body: HelpRequest): HelpRequestAck {
  const id = `req_${hash32(body.clientId).toString(36).padStart(7, '0')}`;
  return { id, status: 'received', clientId: body.clientId };
}

/**
 * POST /intake/voice.
 *
 * THERE IS NO SPEECH RECOGNITION HERE, and the product never claims there is
 * (CLAUDE.md §2). This returns one of a small set of canned results, chosen by hashing
 * the audio's size so the same recording always yields the same result. Real ASR is a
 * backend service; offline, audio is queued, not transcribed.
 */
export function intakeVoice(input: { size: number; lang?: string }): IntakeResult {
  const canned: IntakeResult[] = [
    { transcript: 'വീട്ടിൽ വെള്ളം കയറി, മൂന്ന് പേരുണ്ട്, ഇറങ്ങാൻ പറ്റുന്നില്ല.',
      language: 'ml', structured: { type: 'rescue', urgency: 'critical', peopleCount: 3 } },
    { transcript: 'അമ്മയ്ക്ക് മരുന്ന് തീർന്നു, ഷുഗറിന്റെ മരുന്നാണ്.',
      language: 'ml', structured: { type: 'medical', urgency: 'urgent', peopleCount: 1 } },
    { transcript: 'We need drinking water and food for four people.',
      language: 'en', structured: { type: 'supplies', urgency: 'routine', peopleCount: 4 } },
  ];
  return canned[hash32(`intake:${input.size}`) % canned.length];
}

/** GET /shelters?city=&lat=&lng= */
export function shelters(params: { city: string; lat: number; lng: number }): SheltersResponse {
  const found = cityOr404(params.city);
  const origin = { lat: params.lat, lng: params.lng };

  // One shelter per zone, at a small fixed offset from the ward centre. Capacity and
  // occupancy are derived from the id hash: varied, plausible, and identical every run.
  const list = found.zones.slice(0, 6).map((zone) => {
    const seed = `shelter:${zone.id}`;
    const capacity = 150 + Math.floor(unit(seed) * 7) * 50; // 150..450, in steps of 50
    const occupancy = Math.floor(capacity * (0.25 + unit(`${seed}:occ`) * 0.6));
    const lat = round4(zone.lat + 0.001);
    const lng = round4(zone.lng + 0.001);
    return {
      id: `s_${zone.id}`,
      name: `Govt. HSS ${zone.name}`,
      lat,
      lng,
      capacity,
      occupancy,
      open: occupancy < capacity,
      distanceM: distanceM(origin, { lat, lng }),
    };
  });

  // Nearest first: the list is read in an emergency, top down.
  return { shelters: list.sort((a, b) => a.distanceM - b.distanceM) };
}

const round4 = (n: number) => Math.round(n * 10000) / 10000;

/**
 * GET /nearby?lat=&lng=
 *
 * Names are generic on purpose. Inventing a real hospital's name and phone number in a
 * product people open in an emergency is not a risk worth taking for a demo, so the
 * phone numbers are India's public emergency numbers, which are correct for anyone.
 */
export function nearby(params: { lat: number; lng: number }): NearbyResponse {
  const origin = { lat: params.lat, lng: params.lng };
  const seeds: Array<{ type: 'hospital' | 'fire' | 'police' | 'shelter'; name: string; phone: string; dLat: number; dLng: number }> = [
    { type: 'hospital', name: 'Government General Hospital', phone: '108', dLat: 0.006, dLng: -0.003 },
    { type: 'hospital', name: 'Ward Health Centre', phone: '108', dLat: -0.004, dLng: 0.005 },
    { type: 'fire', name: 'District Fire and Rescue Station', phone: '101', dLat: 0.009, dLng: 0.004 },
    { type: 'police', name: 'City Police Station', phone: '100', dLat: -0.007, dLng: -0.006 },
    { type: 'shelter', name: 'Govt. HSS Kaloor', phone: '1077', dLat: 0.002, dLng: 0.002 },
  ];

  const services = seeds
    .map((seed) => {
      const lat = round4(origin.lat + seed.dLat);
      const lng = round4(origin.lng + seed.dLng);
      return {
        type: seed.type,
        name: seed.name,
        lat,
        lng,
        phone: seed.phone,
        distanceM: distanceM(origin, { lat, lng }),
      };
    })
    .sort((a, b) => a.distanceM - b.distanceM);

  return { services };
}
