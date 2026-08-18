/**
 * THE SEAM (CLAUDE.md §3).
 *
 * This is the only module in the codebase that makes a network call. Screens import the
 * endpoint functions at the bottom of this file and never touch `fetch` themselves. That
 * one choke point is what lets the whole product run with the backend switched off.
 *
 * Three modes, one flag:
 *   'mock'  never touches the network. The demo default, and the safest thing to present.
 *   'auto'  calls the API when one is configured; on ANY failure — offline, non-2xx,
 *           unparseable body, or a 2s timeout — falls back to the mock and flips the
 *           status flag so the chip says so. Nothing blanks, nothing goes silently stale.
 *   'live'  always calls the API and lets failures throw. For integration debugging only:
 *           you want to SEE the error, not have it papered over. Never demo in this mode.
 *
 * Every response goes through a normalise* function before any screen sees it. Those
 * coerce types and re-derive out-of-range values, so a backend field can degrade — wrong
 * type, missing, nonsense number — without taking the app down. A field may degrade; a
 * field may not be renamed (contract §6).
 */
import * as mock from './mock';
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
  NearbyService,
  RequestType,
  ServiceType,
  Shelter,
  SheltersResponse,
  ThresholdRequest,
  ThresholdResponse,
  Urgency,
  Zone,
  ZoneFrame,
} from './contract';

/* ------------------------------------------------------------------------------------ */
/* Mode and status                                                                        */
/* ------------------------------------------------------------------------------------ */

export type ApiMode = 'mock' | 'live' | 'auto';

/** Where the numbers on screen came from. The chip renders exactly this. */
export type ApiStatus = 'live' | 'simulated' | 'offline';

export const API_BASE: string = import.meta.env.VITE_API_BASE ?? '';

/** A slow answer during an emergency is a failed answer. */
export const TIMEOUT_MS = 2000;

/**
 * Circuit breaker.
 *
 * A 2s timeout per call is not enough on its own: a backend that hangs makes every screen
 * pay 2s, and a page needing four calls stalls for eight seconds while still, in the end,
 * showing mock data. That is depending on the backend being up.
 *
 * So after two consecutive failures we stop calling for a while and serve the mock
 * immediately. One probe is allowed through when the window expires, so recovery is
 * automatic and we notice the moment the backend comes back.
 */
const BREAKER_THRESHOLD = 2;
const BREAKER_WINDOW_MS = 30_000;

let consecutiveFailures = 0;
let breakerOpenedAt = 0;

function breakerIsOpen(): boolean {
  if (consecutiveFailures < BREAKER_THRESHOLD) return false;
  if (Date.now() - breakerOpenedAt >= BREAKER_WINDOW_MS) {
    // Window expired: let exactly one call through to test the water.
    consecutiveFailures = BREAKER_THRESHOLD - 1;
    return false;
  }
  return true;
}

function recordFailure() {
  consecutiveFailures += 1;
  if (consecutiveFailures === BREAKER_THRESHOLD) breakerOpenedAt = Date.now();
}

function recordSuccess() {
  consecutiveFailures = 0;
}

/** Exposed for the seam verification script and for a diagnostics view later. */
export function breakerState(): { failures: number; open: boolean } {
  return { failures: consecutiveFailures, open: breakerIsOpen() };
}

/**
 * The single MODE flag. Defaults to 'auto' when an API base is configured, otherwise
 * 'mock' — so a checkout with no environment file runs entirely on committed data.
 */
export const MODE: ApiMode = readMode();

function readMode(): ApiMode {
  const configured = import.meta.env.VITE_API_MODE;
  if (configured === 'mock' || configured === 'live' || configured === 'auto') return configured;
  return API_BASE ? 'auto' : 'mock';
}

/** The last place data actually came from. Combined with connectivity to give the status. */
let lastSource: 'live' | 'simulated' = MODE === 'mock' ? 'simulated' : 'live';
const listeners = new Set<() => void>();

function isOffline(): boolean {
  // navigator.onLine is only trustworthy when it says false, which is exactly the
  // direction we care about: it never claims offline while a request is succeeding.
  return typeof navigator !== 'undefined' && navigator.onLine === false;
}

export function getStatus(): ApiStatus {
  if (isOffline()) return 'offline';
  return lastSource;
}

/** useSyncExternalStore-shaped subscription, so the chip re-renders the moment this moves. */
export function subscribeToStatus(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function announce() {
  for (const listener of listeners) listener();
}

function setSource(next: 'live' | 'simulated') {
  if (next === lastSource) return;
  lastSource = next;
  announce();
}

// Connectivity changes must move the chip immediately, without waiting for a request.
if (typeof window !== 'undefined') {
  window.addEventListener('online', announce);
  window.addEventListener('offline', announce);
}

/* ------------------------------------------------------------------------------------ */
/* Normalisers — a field may degrade, a field may not be renamed                          */
/* ------------------------------------------------------------------------------------ */

type Unknown = Record<string, unknown>;

const asRecord = (value: unknown): Unknown =>
  value !== null && typeof value === 'object' ? (value as Unknown) : {};

/** Coerce to a finite number, falling back when the backend sends "12" or null or NaN. */
function normaliseNumber(value: unknown, fallback: number): number {
  const n = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(n) ? n : fallback;
}

/** Coerce, then pull back inside [min, max]. Out-of-range must not reach a renderer. */
function normaliseRange(value: unknown, fallback: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, normaliseNumber(value, fallback)));
}

function normaliseString(value: unknown, fallback: string): string {
  return typeof value === 'string' && value.length > 0 ? value : fallback;
}

function normaliseBoolean(value: unknown, fallback: boolean): boolean {
  return typeof value === 'boolean' ? value : fallback;
}

/** Enum guard: anything not in the contract's set degrades to the given default. */
function normaliseEnum<T extends string>(value: unknown, allowed: readonly T[], fallback: T): T {
  return allowed.includes(value as T) ? (value as T) : fallback;
}

const LEVELS = ['none', 'watch', 'alert', 'warning'] as const;
const TRENDS = ['rising', 'steady', 'falling'] as const;
const URGENCIES = ['routine', 'urgent', 'critical'] as const;
const REQUEST_TYPES = ['rescue', 'medical', 'supplies', 'shelter', 'other'] as const;
const SERVICE_TYPES = ['hospital', 'fire', 'police', 'shelter'] as const;
const HAZARD_IDS = ['flood', 'landslide', 'heat', 'fire', 'aqi', 'cyclone'] as const;
const UNITS = ['cm', 'probability', 'C_wbgt', 'm_s', 'aqi'] as const;

function normaliseArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

export function normaliseBands(value: unknown): Band[] {
  const bands = normaliseArray(value).map((raw) => {
    const band = asRecord(raw);
    return {
      level: normaliseEnum(band.level, LEVELS, 'none'),
      min: normaliseNumber(band.min, 0),
      // null is meaningful on the top band — "and above" — so it is preserved, not coerced.
      max: band.max === null || band.max === undefined ? null : normaliseNumber(band.max, 0),
    };
  });
  // Without bands nothing downstream can colour anything, so fall back to the mock's.
  return bands.length > 0 ? bands : mock.levelBands('flood');
}

/**
 * A level that disagrees with its own exposure is worse than a missing one: it would
 * colour the interface wrongly. So the level is always RE-DERIVED from the bands, and the
 * backend's value is only used when the bands cannot decide.
 */
export function normaliseLevel(value: unknown, bands: Band[], exposure: number): Level {
  if (bands.length > 0) return mock.levelFor(bands, exposure);
  return normaliseEnum(value, LEVELS, 'none');
}

export function normaliseHealth(value: unknown): Health {
  const raw = asRecord(value);
  return {
    status: normaliseString(raw.status, 'unknown'),
    version: normaliseString(raw.version, 'unknown'),
    hazards: normaliseArray(raw.hazards)
      .map((h) => normaliseEnum(h, HAZARD_IDS, 'flood'))
      .filter((h, i, all): h is HazardId => all.indexOf(h) === i),
    cities: normaliseArray(raw.cities).map((c) => normaliseString(c, '')).filter(Boolean),
  };
}

function normaliseZone(value: unknown): Zone {
  const raw = asRecord(value);
  const name = normaliseString(raw.name, 'Unknown zone');
  return {
    id: normaliseString(raw.id, 'unknown'),
    name,
    // Malayalam missing is survivable: show the English name rather than an empty line.
    name_ml: normaliseString(raw.name_ml, name),
    lat: normaliseRange(raw.lat, 0, -90, 90),
    lng: normaliseRange(raw.lng, 0, -180, 180),
    population: Math.max(0, Math.round(normaliseNumber(raw.population, 0))),
  };
}

export function normaliseCity(value: unknown): City {
  const raw = asRecord(value);
  const center = asRecord(raw.center);
  return {
    id: normaliseString(raw.id, mock.DEFAULT_CITY),
    name: normaliseString(raw.name, 'Unknown city'),
    hazards: normaliseArray(raw.hazards).map((h) => normaliseEnum(h, HAZARD_IDS, 'flood')),
    center: {
      lat: normaliseRange(center.lat, 0, -90, 90),
      lng: normaliseRange(center.lng, 0, -180, 180),
    },
    zones: normaliseArray(raw.zones).map(normaliseZone),
  };
}

function normaliseZoneFrame(value: unknown, bands: Band[]): ZoneFrame {
  const raw = asRecord(value);
  // Exposure can never be negative — a negative water depth would break every renderer.
  const exposure = Math.max(0, normaliseNumber(raw.exposure, 0));
  return {
    id: normaliseString(raw.id, 'unknown'),
    exposure,
    level: normaliseLevel(raw.level, bands, exposure),
    risk: normaliseRange(raw.risk, 0, 0, 1),
    trend: normaliseEnum(raw.trend, TRENDS, 'steady'),
  };
}

function normaliseFrame(value: unknown, bands: Band[]): Frame {
  const raw = asRecord(value);
  return {
    offsetMin: Math.max(0, Math.round(normaliseNumber(raw.offsetMin, 0))),
    zones: normaliseArray(raw.zones).map((zone) => normaliseZoneFrame(zone, bands)),
  };
}

export function normaliseForecast(value: unknown): Forecast {
  const raw = asRecord(value);
  const bands = normaliseBands(raw.bands);
  return {
    generatedAt: normaliseString(raw.generatedAt, mock.SCENARIO_EPOCH),
    city: normaliseString(raw.city, mock.DEFAULT_CITY),
    hazard: normaliseEnum(raw.hazard, HAZARD_IDS, 'flood'),
    unit: normaliseEnum(raw.unit, UNITS, 'cm'),
    intensity: Math.max(0, normaliseNumber(raw.intensity, 0)),
    // The contract says this is shown to the user, so an unrecognised value is treated
    // as 'fallback'. We would rather understate the provenance than overstate it.
    source: raw.source === 'model' ? 'model' : 'fallback',
    bands,
    // Frames must be in ascending time or the scrubber runs backwards.
    frames: normaliseArray(raw.frames)
      .map((frame) => normaliseFrame(frame, bands))
      .sort((a, b) => a.offsetMin - b.offsetMin),
  };
}

export function normaliseThreshold(value: unknown, unitFallback: HazardUnit = 'cm'): ThresholdResponse {
  const raw = asRecord(value);
  const exposure = Math.max(0, normaliseNumber(raw.exposure, 0));
  const crosses = raw.crossesAtMin;
  return {
    // No bands in this payload, so the backend's level is used as given, guarded by enum.
    level: normaliseEnum(raw.level, LEVELS, 'none'),
    exposure,
    unit: normaliseEnum(raw.unit, UNITS, unitFallback),
    threshold: Math.max(0, normaliseNumber(raw.threshold, 0)),
    // null is meaningful — "never crosses" — so it survives; anything else must be >= 0.
    crossesAtMin: crosses === null || crosses === undefined ? null : Math.max(0, Math.round(normaliseNumber(crosses, 0))),
    leadTimeMin: Math.max(0, Math.round(normaliseNumber(raw.leadTimeMin, 30))),
    action: normaliseString(raw.action, 'Stay alert and follow local instructions.'),
    // Malayalam missing degrades to the English line rather than to an empty screen.
    action_ml: normaliseString(raw.action_ml, normaliseString(raw.action, '')),
    reasons: normaliseArray(raw.reasons).map((r) => normaliseString(r, '')).filter(Boolean),
  };
}

export function normaliseAck(value: unknown, clientId: string): HelpRequestAck {
  const raw = asRecord(value);
  return {
    id: normaliseString(raw.id, `req_${clientId.slice(0, 8)}`),
    status: normaliseString(raw.status, 'received'),
    // The echo is the idempotency key. If the backend loses it, we restore ours.
    clientId: normaliseString(raw.clientId, clientId),
  };
}

export function normaliseIntake(value: unknown): IntakeResult {
  const raw = asRecord(value);
  const structured = asRecord(raw.structured);
  return {
    transcript: normaliseString(raw.transcript, ''),
    language: normaliseString(raw.language, 'ml'),
    structured: {
      type: normaliseEnum<RequestType>(structured.type, REQUEST_TYPES, 'other'),
      // An unreadable urgency is treated as urgent: under-reacting is the worse error.
      urgency: normaliseEnum<Urgency>(structured.urgency, URGENCIES, 'urgent'),
      peopleCount: Math.max(0, Math.round(normaliseNumber(structured.peopleCount, 1))),
    },
  };
}

function normaliseShelter(value: unknown): Shelter {
  const raw = asRecord(value);
  const capacity = Math.max(0, Math.round(normaliseNumber(raw.capacity, 0)));
  // Occupancy above capacity is nonsense on a card that says "space left", so it is
  // clamped rather than displayed.
  const occupancy = Math.min(capacity, Math.max(0, Math.round(normaliseNumber(raw.occupancy, 0))));
  return {
    id: normaliseString(raw.id, 'unknown'),
    name: normaliseString(raw.name, 'Shelter'),
    lat: normaliseRange(raw.lat, 0, -90, 90),
    lng: normaliseRange(raw.lng, 0, -180, 180),
    capacity,
    occupancy,
    open: normaliseBoolean(raw.open, occupancy < capacity),
    distanceM: Math.max(0, Math.round(normaliseNumber(raw.distanceM, 0))),
  };
}

export function normaliseShelters(value: unknown): SheltersResponse {
  const raw = asRecord(value);
  return {
    shelters: normaliseArray(raw.shelters).map(normaliseShelter).sort((a, b) => a.distanceM - b.distanceM),
  };
}

function normaliseService(value: unknown): NearbyService {
  const raw = asRecord(value);
  return {
    type: normaliseEnum<ServiceType>(raw.type, SERVICE_TYPES, 'hospital'),
    name: normaliseString(raw.name, 'Emergency service'),
    lat: normaliseRange(raw.lat, 0, -90, 90),
    lng: normaliseRange(raw.lng, 0, -180, 180),
    phone: normaliseString(raw.phone, '112'),
    distanceM: Math.max(0, Math.round(normaliseNumber(raw.distanceM, 0))),
  };
}

export function normaliseNearby(value: unknown): NearbyResponse {
  const raw = asRecord(value);
  return {
    services: normaliseArray(raw.services).map(normaliseService).sort((a, b) => a.distanceM - b.distanceM),
  };
}

/* ------------------------------------------------------------------------------------ */
/* The one network call                                                                   */
/* ------------------------------------------------------------------------------------ */

type Call<T> = {
  /** Contract path, e.g. `/forecast?city=kochi`. */
  path: string;
  init?: RequestInit;
  /** What to serve when the network is not available or not trusted. Must never throw. */
  fallback: () => T;
  /** Applied to the live body before any screen sees it. */
  normalise: (raw: unknown) => T;
};

async function call<T>({ path, init, fallback, normalise }: Call<T>): Promise<T> {
  if (MODE === 'mock') {
    setSource('simulated');
    return fallback();
  }

  // Known-offline, or the backend has already failed twice: skip the fetch entirely
  // rather than burn another 2s waiting for it to fail again.
  if (MODE === 'auto' && (isOffline() || breakerIsOpen())) {
    setSource('simulated');
    return fallback();
  }

  try {
    const response = await fetch(`${API_BASE}${path}`, {
      ...init,
      headers:
        init?.body instanceof FormData
          ? init?.headers
          : { 'content-type': 'application/json', ...init?.headers },
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    if (!response.ok) throw new Error(`${path} responded ${response.status}`);
    const body: unknown = await response.json();
    recordSuccess();
    setSource('live');
    return normalise(body);
  } catch (error) {
    recordFailure();
    if (MODE === 'live') {
      // Deliberate: in live mode you are debugging integration and you want the error.
      setSource('live');
      throw error;
    }
    // Loud in the console for us, visible in the chip for the resident (CLAUDE.md §2).
    console.warn(`[api] ${path} fell back to simulated data:`, error);
    setSource('simulated');
    return fallback();
  }
}

/* ------------------------------------------------------------------------------------ */
/* The endpoints — one per contract §6 entry. Screens use only these.                     */
/* ------------------------------------------------------------------------------------ */

export function getHealth(): Promise<Health> {
  return call({
    path: '/health',
    fallback: () => mock.health(),
    normalise: normaliseHealth,
  });
}

export function getCity(city: string = mock.DEFAULT_CITY): Promise<City> {
  return call({
    path: `/cities/${encodeURIComponent(city)}`,
    fallback: () => mock.city(city),
    normalise: normaliseCity,
  });
}

export function getForecast(params: {
  city?: string;
  hazard?: HazardId;
  intensity: number;
}): Promise<Forecast> {
  const city = params.city ?? mock.DEFAULT_CITY;
  const hazard = params.hazard ?? 'flood';
  const query = new URLSearchParams({
    city,
    hazard,
    intensity: String(params.intensity),
  });
  return call({
    path: `/forecast?${query}`,
    fallback: () => mock.forecast({ city, hazard, intensity: params.intensity }),
    normalise: normaliseForecast,
  });
}

export function postThreshold(body: ThresholdRequest): Promise<ThresholdResponse> {
  return call({
    path: '/household/threshold',
    init: { method: 'POST', body: JSON.stringify(body) },
    fallback: () => mock.threshold(body),
    normalise: (raw) => normaliseThreshold(raw),
  });
}

export function postRequest(body: HelpRequest): Promise<HelpRequestAck> {
  return call({
    path: '/requests',
    init: { method: 'POST', body: JSON.stringify(body) },
    fallback: () => mock.createRequest(body),
    normalise: (raw) => normaliseAck(raw, body.clientId),
  });
}

export function postVoiceIntake(audio: Blob, meta?: { lat?: number; lng?: number; lang?: string }): Promise<IntakeResult> {
  const form = new FormData();
  form.append('audio', audio);
  if (meta?.lat !== undefined) form.append('lat', String(meta.lat));
  if (meta?.lng !== undefined) form.append('lng', String(meta.lng));
  if (meta?.lang) form.append('lang', meta.lang);
  return call({
    path: '/intake/voice',
    init: { method: 'POST', body: form },
    // No speech recognition happens offline, and we never claim otherwise (CLAUDE.md §2).
    fallback: () => mock.intakeVoice({ size: audio.size, lang: meta?.lang }),
    normalise: normaliseIntake,
  });
}

export function getShelters(params: { city?: string; lat: number; lng: number }): Promise<SheltersResponse> {
  const city = params.city ?? mock.DEFAULT_CITY;
  const query = new URLSearchParams({ city, lat: String(params.lat), lng: String(params.lng) });
  return call({
    path: `/shelters?${query}`,
    fallback: () => mock.shelters({ city, lat: params.lat, lng: params.lng }),
    normalise: normaliseShelters,
  });
}

export function getNearby(params: { lat: number; lng: number }): Promise<NearbyResponse> {
  const query = new URLSearchParams({ lat: String(params.lat), lng: String(params.lng) });
  return call({
    path: `/nearby?${query}`,
    fallback: () => mock.nearby(params),
    normalise: normaliseNearby,
  });
}
