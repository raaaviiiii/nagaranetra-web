/**
 * The mock is the thing the demo actually runs on, so it gets the tests.
 *
 * Two jobs here:
 *   1. DETERMINISM — the same inputs must give byte-identical outputs, or a rehearsal and
 *      the real run show different numbers.
 *   2. The four model validation properties the contract holds both repos to (§8):
 *      monotonic in time, monotonic in intensity, dry reads exactly zero, and levels
 *      staggered across zones — "or the demo has no drama and no credibility".
 *
 * Plus a shape check per endpoint, because a mock that drifts from the contract is worse
 * than no mock: it moves the integration failure to the moment it is most expensive.
 *
 * Run: npm run test
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as mock from './mock.ts';
import type { Level, Profile, ThresholdRequest } from './contract.ts';

const CITY = 'kochi';
const INTENSITIES = [0, 18, 40, 62, 90, 140];

/** Every (city, hazard) pair the mock serves. The model properties must hold for all. */
const SCENARIOS: Array<{ city: string; hazard: 'flood' | 'landslide' }> = [
  { city: 'kochi', hazard: 'flood' },
  { city: 'wayanad', hazard: 'landslide' },
  { city: 'wayanad', hazard: 'flood' },
];

/** The contract's worked example profile, copied from §6. */
const EXAMPLE_PROFILE: Profile = {
  buildingType: 'independent',
  floorLevel: 0,
  householdSize: 4,
  hasElderly: true,
  hasLimitedMobility: true,
  hasVehicle: false,
  language: 'ml',
};

const exampleRequest = (over: Partial<ThresholdRequest> = {}): ThresholdRequest => ({
  city: CITY,
  zoneId: 'kaloor',
  hazard: 'flood',
  intensity: 62,
  profile: EXAMPLE_PROFILE,
  ...over,
});

/** Asserts an object has exactly these keys — catches both drift and accidental extras. */
function assertKeys(value: object, keys: string[], label: string) {
  assert.deepEqual(Object.keys(value).sort(), [...keys].sort(), `${label}: field names must match the contract`);
}

const HAZARDS = ['flood', 'landslide'] as const;

/* ---- 1. Determinism ------------------------------------------------------------------ */

test('determinism: identical inputs produce identical output, every endpoint', () => {
  for (const { city, hazard } of SCENARIOS) {
    for (const intensity of INTENSITIES) {
      const a = mock.forecast({ city, hazard, intensity });
      const b = mock.forecast({ city, hazard, intensity });
      assert.equal(JSON.stringify(a), JSON.stringify(b), `forecast ${city}/${hazard} @ ${intensity}`);
    }
  }
  for (const hazard of HAZARDS) {
    const request = hazard === 'flood' ? exampleRequest() : exampleRequest({ city: 'wayanad', zoneId: 'demo-landslide', hazard });
    assert.deepEqual(mock.threshold(request), mock.threshold(request));
  }

  assert.deepEqual(mock.health(), mock.health());
  assert.deepEqual(mock.city(CITY), mock.city(CITY));
  assert.deepEqual(mock.shelters({ city: CITY, lat: 9.997, lng: 76.299 }), mock.shelters({ city: CITY, lat: 9.997, lng: 76.299 }));
  assert.deepEqual(mock.nearby({ lat: 9.997, lng: 76.299 }), mock.nearby({ lat: 9.997, lng: 76.299 }));
  assert.deepEqual(mock.intakeVoice({ size: 4096 }), mock.intakeVoice({ size: 4096 }));
});

test('determinism: generatedAt is a fixed scenario epoch, not the wall clock', () => {
  assert.equal(mock.forecast({ city: CITY, hazard: 'flood', intensity: 62 }).generatedAt, mock.SCENARIO_EPOCH);
});

/* ---- 2. The four validation properties (contract §8) --------------------------------- */

test('validation: dry input reads exactly zero, not a floor value', () => {
  for (const { city, hazard } of SCENARIOS) {
    const dry = mock.forecast({ city, hazard, intensity: 0 });
    for (const frame of dry.frames) {
      for (const zone of frame.zones) {
        assert.equal(zone.exposure, 0, `${city}/${hazard} ${zone.id} @ ${frame.offsetMin}min must be exactly 0`);
        assert.equal(zone.level, 'none');
        assert.equal(zone.risk, 0);
      }
    }
  }
});

test('validation: monotonic in time — exposure never falls as the horizon advances', () => {
  for (const { city, hazard } of SCENARIOS) {
    for (const intensity of INTENSITIES) {
      const forecast = mock.forecast({ city, hazard, intensity });
      const seen = new Map<string, number>();
      for (const frame of forecast.frames) {
        for (const zone of frame.zones) {
          const previous = seen.get(zone.id) ?? 0;
          assert.ok(
            zone.exposure >= previous,
            `${city}/${hazard} ${zone.id} fell from ${previous} to ${zone.exposure} at ${frame.offsetMin}min`,
          );
          seen.set(zone.id, zone.exposure);
        }
      }
    }
  }
});

test('validation: monotonic in intensity — harder rain is never a smaller number', () => {
  for (const { city, hazard } of SCENARIOS) {
    for (let i = 1; i < INTENSITIES.length; i++) {
      const lower = mock.forecast({ city, hazard, intensity: INTENSITIES[i - 1] });
      const higher = mock.forecast({ city, hazard, intensity: INTENSITIES[i] });
      lower.frames.forEach((frame, fi) => {
        frame.zones.forEach((zone, zi) => {
          const other = higher.frames[fi].zones[zi];
          assert.equal(zone.id, other.id);
          assert.ok(
            other.exposure >= zone.exposure,
            `${city}/${hazard} ${zone.id} @ ${frame.offsetMin}min: intensity ${INTENSITIES[i]} gave ${other.exposure}, less than ${zone.exposure}`,
          );
        });
      });
    }
  }
});

test('validation: levels are staggered across zones — they do not all cross at once', () => {
  for (const scenario of [
    { city: 'kochi', hazard: 'flood' as const, intensity: 62 },
    { city: 'wayanad', hazard: 'landslide' as const, intensity: 62 },
  ]) {
    assertStaggered(scenario);
  }
});

function assertStaggered({ city, hazard, intensity }: { city: string; hazard: 'flood' | 'landslide'; intensity: number }) {
  const forecast = mock.forecast({ city, hazard, intensity });

  // For each zone, the first offset at which it reaches 'alert' or worse.
  const crossings = new Map<string, number | null>();
  for (const frame of forecast.frames) {
    for (const zone of frame.zones) {
      if (crossings.get(zone.id) != null) continue;
      const bad: Level[] = ['alert', 'warning'];
      if (bad.includes(zone.level)) crossings.set(zone.id, frame.offsetMin);
      else if (!crossings.has(zone.id)) crossings.set(zone.id, null);
    }
  }

  const distinct = new Set([...crossings.values()]);
  assert.ok(distinct.size >= 3, `${city}/${hazard}: expected zones to cross at different times, got ${[...distinct].join(', ')}`);

  // And the whole city must not be in one band at the start — nothing to read otherwise.
  const first = forecast.frames[0].zones.map((z) => z.level);
  assert.ok(new Set(first).size >= 2, `${city}/${hazard}: all zones start in the same band: ${first.join(', ')}`);
}

test('a city is only shown the hazards it actually faces', () => {
  // Kochi is flat, so its landslide exposure is ~0. The honest response is to not list
  // the hazard at all rather than to show a permanently green landslide card.
  assert.deepEqual(mock.city('kochi').hazards, ['flood']);
  assert.deepEqual(mock.city('wayanad').hazards, ['landslide', 'flood']);

  const flatLandslide = mock.forecast({ city: 'kochi', hazard: 'landslide', intensity: 140 });
  const worst = Math.max(...flatLandslide.frames.at(-1)!.zones.map((z) => z.exposure));
  assert.ok(worst < 0.4, `flat terrain must not produce a landslide alert, got ${worst}`);

  const hills = mock.forecast({ city: 'wayanad', hazard: 'landslide', intensity: 62 });
  const steepest = Math.max(...hills.frames.at(-1)!.zones.map((z) => z.exposure));
  assert.ok(steepest >= 0.65, `steep terrain must reach warning, got ${steepest}`);
});

/* ---- 3. The product claim ------------------------------------------------------------- */

test('the claim: same street, same rain, different answer per household', () => {
  const ground = mock.threshold(exampleRequest());
  const third = mock.threshold(
    exampleRequest({ profile: { ...EXAMPLE_PROFILE, floorLevel: 3 } }),
  );

  assert.ok(ground.exposure > third.exposure, 'a ground floor must be more exposed than a third floor');
  assert.equal(third.exposure, 0, 'water below the third floor does not reach that household');
  assert.notEqual(ground.action, third.action, 'the two households must be told different things');
  assert.notEqual(ground.level, third.level);
});

test('the claim: dependencies change lead time, not exposure (contract §2 stage 2)', () => {
  const dependent = mock.threshold(exampleRequest());
  const independent = mock.threshold(
    exampleRequest({
      profile: { ...EXAMPLE_PROFILE, hasElderly: false, hasLimitedMobility: false, hasVehicle: true },
    }),
  );

  assert.equal(dependent.exposure, independent.exposure, 'exposure must not move with dependencies');
  assert.ok(dependent.leadTimeMin > independent.leadTimeMin, 'someone who needs help needs warning earlier');
  // The contract's worked example: elderly + limited mobility + no vehicle, household of 4.
  assert.equal(dependent.leadTimeMin, 90);
  assert.deepEqual(dependent.reasons, [
    'Ground floor',
    'Someone in the house needs help to move',
    'No vehicle available',
  ]);
});

test('the claim: the threshold is the household limit and the crossing is on the same grid', () => {
  const answer = mock.threshold(exampleRequest({ intensity: 90 }));
  assert.equal(answer.threshold, 30, 'independent, ground floor -> 30 cm, per the contract example');
  assert.ok(answer.crossesAtMin === null || answer.crossesAtMin % 15 === 0, 'crossing must land on a published frame');
});

/* ---- 4. Contract shapes ---------------------------------------------------------------- */

test('shape: GET /health', () => {
  const health = mock.health();
  assertKeys(health, ['status', 'version', 'hazards', 'cities'], 'health');
  assert.equal(health.status, 'ok');
  assert.ok(health.hazards.length >= 2, 'contract §3 requires at least two hazards');
  assert.ok(health.cities.includes(CITY));
  assert.ok(health.cities.includes('wayanad'));
});

test('shape: GET /cities/{city}', () => {
  for (const id of mock.health().cities) assertCityShape(id);
});

function assertCityShape(id: string) {
  const city = mock.city(id);
  assertKeys(city, ['id', 'name', 'hazards', 'center', 'zones'], 'city');
  assertKeys(city.center, ['lat', 'lng'], 'city.center');
  assert.ok(city.zones.length > 0);
  for (const zone of city.zones) {
    assertKeys(zone, ['id', 'name', 'name_ml', 'lat', 'lng', 'population'], 'zone');
    assert.ok(zone.name_ml.length > 0, `${zone.id} must carry a Malayalam name`);
    assert.notEqual(zone.name_ml, zone.name, `${zone.id} name_ml must not be the English name`);
  }
}

test('shape: GET /forecast', () => {
  const forecast = mock.forecast({ city: CITY, hazard: 'flood', intensity: 62 });
  assertKeys(forecast, ['generatedAt', 'city', 'hazard', 'unit', 'intensity', 'source', 'bands', 'frames'], 'forecast');
  assert.equal(forecast.unit, 'cm');
  // The mock IS the fallback path; saying "model" here would be a lie on screen.
  assert.equal(forecast.source, 'fallback');

  for (const band of forecast.bands) assertKeys(band, ['level', 'min', 'max'], 'band');
  assert.equal(forecast.bands.at(-1)?.max, null, 'the top band is open-ended');

  // Every offset in one response, so the scrubber never re-fetches (contract §6).
  assert.ok(forecast.frames.length > 1);
  assert.equal(forecast.frames[0].offsetMin, 0);
  for (const frame of forecast.frames) {
    assertKeys(frame, ['offsetMin', 'zones'], 'frame');
    for (const zone of frame.zones) {
      assertKeys(zone, ['id', 'exposure', 'level', 'risk', 'trend'], 'zone frame');
      assert.ok(zone.risk >= 0 && zone.risk <= 1, 'risk is a 0..1 value');
      assert.ok(['none', 'watch', 'alert', 'warning'].includes(zone.level));
      assert.ok(['rising', 'steady', 'falling'].includes(zone.trend));
      // The level must agree with the bands, or the interface is coloured wrongly.
      assert.equal(zone.level, mock.levelFor(forecast.bands, zone.exposure));
    }
  }
});

test('shape: POST /household/threshold', () => {
  const answer = mock.threshold(exampleRequest());
  assertKeys(
    answer,
    ['level', 'exposure', 'unit', 'threshold', 'crossesAtMin', 'leadTimeMin', 'action', 'action_ml', 'reasons'],
    'threshold',
  );
  assert.ok(answer.action.length > 0 && answer.action_ml.length > 0, 'both languages are required');
  assert.notEqual(answer.action, answer.action_ml);
  assert.ok(answer.reasons.every((r) => typeof r === 'string' && r.length > 0));
});

test('shape: POST /requests is idempotent on clientId', () => {
  const body = {
    type: 'rescue' as const,
    urgency: 'critical' as const,
    lat: 9.997,
    lng: 76.299,
    createdAt: '2026-08-18T10:00:00Z',
    clientId: 'e6f1b0c2-0000-4000-8000-000000000001',
  };
  const first = mock.createRequest(body);
  const second = mock.createRequest(body);
  assertKeys(first, ['id', 'status', 'clientId'], 'ack');
  assert.equal(first.id, second.id, 'a replayed queue item must not create a second request');
  assert.equal(first.clientId, body.clientId, 'clientId is echoed back');
  assert.notEqual(mock.createRequest({ ...body, clientId: 'other' }).id, first.id);
});

test('shape: POST /intake/voice', () => {
  const result = mock.intakeVoice({ size: 12345 });
  assertKeys(result, ['transcript', 'language', 'structured'], 'intake');
  assertKeys(result.structured, ['type', 'urgency', 'peopleCount'], 'intake.structured');
  assert.ok(['rescue', 'medical', 'supplies', 'shelter', 'other'].includes(result.structured.type));
  assert.ok(['routine', 'urgent', 'critical'].includes(result.structured.urgency));
});

test('shape: GET /shelters', () => {
  const { shelters } = mock.shelters({ city: CITY, lat: 9.997, lng: 76.299 });
  assert.ok(shelters.length > 0);
  let previous = -1;
  for (const shelter of shelters) {
    assertKeys(shelter, ['id', 'name', 'lat', 'lng', 'capacity', 'occupancy', 'open', 'distanceM'], 'shelter');
    assert.ok(shelter.occupancy <= shelter.capacity, 'occupancy above capacity is nonsense on a card');
    assert.ok(shelter.distanceM >= previous, 'nearest first — the list is read top down in an emergency');
    previous = shelter.distanceM;
  }
});

test('shape: GET /nearby', () => {
  const { services } = mock.nearby({ lat: 9.997, lng: 76.299 });
  assert.ok(services.length > 0);
  for (const service of services) {
    assertKeys(service, ['type', 'name', 'lat', 'lng', 'phone', 'distanceM'], 'service');
    assert.ok(['hospital', 'fire', 'police', 'shelter'].includes(service.type));
  }
});

test('errors use the contract error codes', () => {
  assert.throws(() => mock.city('atlantis'), /Unknown city/);
  assert.throws(() => mock.forecast({ city: CITY, hazard: 'volcano', intensity: 10 }), /Unknown hazard/);
  assert.throws(() => mock.threshold(exampleRequest({ zoneId: 'nowhere' })), /Unknown zone id/);
});
