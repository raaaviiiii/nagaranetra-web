/**
 * TypeScript transcription of docs/API_CONTRACT.md §6 — FROZEN.
 *
 * This file is a mirror, not a design. Every name here appears in the contract; nothing
 * here may be renamed to suit the frontend. A field can degrade; a field cannot be
 * renamed. If a shape needs to change, the contract changes first, by agreement, and both
 * repos update in the same sitting.
 *
 * Optional markers (`?`) mean "the backend may omit this and we will survive" — they are a
 * statement about resilience, handled by the normalise* functions in api.ts, not a licence
 * for the backend to leave the field out.
 */

/* ---- Shared enums (contract §6, "Shared enums") ------------------------------------ */

/** The IMD ladder. The only chromatic colours in the product map one-to-one to this. */
export type Level = 'none' | 'watch' | 'alert' | 'warning';
export type Trend = 'rising' | 'steady' | 'falling';
export type BuildingType = 'independent' | 'apartment' | 'row' | 'hut' | 'commercial';
export type Urgency = 'routine' | 'urgent' | 'critical';

/** Hazard ids and units, from the plug-in contract (§3). */
export type HazardId = 'flood' | 'landslide' | 'heat' | 'fire' | 'aqi' | 'cyclone';
export type HazardUnit = 'cm' | 'probability' | 'C_wbgt' | 'm_s' | 'aqi';

/** Request categories accepted by POST /requests. */
export type RequestType = 'rescue' | 'medical' | 'supplies' | 'shelter' | 'other';

/** Emergency service categories returned by GET /nearby. */
export type ServiceType = 'hospital' | 'fire' | 'police' | 'shelter';

/* ---- GET /health -------------------------------------------------------------------- */

export type Health = {
  status: string;
  version: string;
  hazards: HazardId[];
  cities: string[];
};

/* ---- GET /cities/{city} ------------------------------------------------------------- */

export type LatLng = { lat: number; lng: number };

export type Zone = {
  id: string;
  name: string;
  name_ml: string;
  lat: number;
  lng: number;
  population: number;
};

export type City = {
  id: string;
  name: string;
  hazards: HazardId[];
  center: LatLng;
  zones: Zone[];
};

/* ---- GET /forecast?city=&hazard=&intensity= ----------------------------------------- */

/** Exposure -> IMD level. `max: null` on the top band means "and above". */
export type Band = { level: Level; min: number; max: number | null };

export type ZoneFrame = {
  id: string;
  exposure: number;
  level: Level;
  /** 0..1. */
  risk: number;
  trend: Trend;
};

export type Frame = { offsetMin: number; zones: ZoneFrame[] };

export type Forecast = {
  generatedAt: string;
  city: string;
  hazard: HazardId;
  unit: HazardUnit;
  intensity: number;
  /** "model" or "fallback". Shown to the user, so it must be accurate (contract §6, §8). */
  source: 'model' | 'fallback';
  bands: Band[];
  /** Every time offset in one response, so the scrubber never re-fetches. */
  frames: Frame[];
};

/* ---- POST /household/threshold ------------------------------------------------------ */

export type Profile = {
  buildingType: BuildingType;
  /** 0 = ground floor. */
  floorLevel: number;
  householdSize: number;
  hasElderly: boolean;
  hasLimitedMobility: boolean;
  hasVehicle: boolean;
  language: 'en' | 'ml';
};

export type ThresholdRequest = {
  city: string;
  zoneId: string;
  hazard: HazardId;
  intensity: number;
  profile: Profile;
};

export type ThresholdResponse = {
  level: Level;
  exposure: number;
  unit: HazardUnit;
  /** THIS household's limit. The frontend draws it as the threshold line. */
  threshold: number;
  /** Minutes until exposure crosses the threshold; null if it never does. */
  crossesAtMin: number | null;
  /** Minutes this household needs to act. Dependencies raise it. */
  leadTimeMin: number;
  action: string;
  action_ml: string;
  /** Shown verbatim, in plain language, from the resident's side of the screen. */
  reasons: string[];
};

/* ---- POST /requests ----------------------------------------------------------------- */

export type HelpRequest = {
  type: RequestType;
  urgency: Urgency;
  lat: number;
  lng: number;
  text?: string;
  profileId?: string;
  createdAt: string;
  /** Generated offline and echoed back, so a replayed queue cannot duplicate. */
  clientId: string;
};

export type HelpRequestAck = {
  id: string;
  status: string;
  clientId: string;
};

/* ---- POST /intake/voice (multipart/form-data) --------------------------------------- */

export type IntakeResult = {
  transcript: string;
  language: string;
  structured: {
    type: RequestType;
    urgency: Urgency;
    peopleCount: number;
  };
};

/* ---- GET /shelters?city=&lat=&lng= --------------------------------------------------- */

export type Shelter = {
  id: string;
  name: string;
  lat: number;
  lng: number;
  capacity: number;
  occupancy: number;
  open: boolean;
  distanceM: number;
};

export type SheltersResponse = { shelters: Shelter[] };

/* ---- GET /nearby?lat=&lng= ----------------------------------------------------------- */

export type NearbyService = {
  type: ServiceType;
  name: string;
  lat: number;
  lng: number;
  phone: string;
  distanceM: number;
};

export type NearbyResponse = { services: NearbyService[] };

/* ---- Error shape — same for every endpoint ------------------------------------------ */

export type ApiError = { error: { code: string; message: string } };
