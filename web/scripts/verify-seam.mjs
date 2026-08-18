/* PROOF that the app runs with the backend switched off (CLAUDE.md §3).
 *
 * Reading api.ts and believing it is not evidence. This drives the REAL module in a REAL
 * browser, against a backend that is variously hanging, refusing, and absent, and checks
 * what the resident would actually see.
 *
 * Four phases:
 *   1. HANGING BACKEND   a server that accepts the connection and never answers. Every
 *                        endpoint must still return contract-shaped data, inside the 2s
 *                        timeout, and the status must flip to 'simulated'.
 *   2. VISIBLE STATUS    the chip in the DOM must say so. A fallback the user cannot see
 *                        is the failure mode this rule exists to prevent.
 *   3. FULLY OFFLINE     network disabled at the browser level. Data still arrives, and
 *                        the chip must say 'Offline'.
 *   4. NO BACKEND AT ALL mode 'mock' with no API base: every endpoint returns, and the
 *                        browser must make ZERO requests to any API origin.
 *
 * Run: npm run verify:seam     (needs nothing else running; it starts what it needs)
 */
import { spawn } from 'node:child_process';
import { createServer } from 'node:http';
import { writeFileSync } from 'node:fs';
import { connect, evaluate, launchChrome, pageTarget, wait, waitForServer } from './cdp.mjs';

const BLACKHOLE_PORT = 59998;
const VITE_PORT = 5199;
const CDP_PORT = 9333;
const ORIGIN = `http://localhost:${VITE_PORT}`;
const BLACKHOLE = `http://127.0.0.1:${BLACKHOLE_PORT}`;

let failures = 0;
/** Keep a picture of each state: §8 says verify by looking, and the chip is the point. */
async function capture(cdp, name) {
  const shot = await cdp.send('Page.captureScreenshot', { format: 'png', clip: { x: 0, y: 0, width: 900, height: 120, scale: 1 } });
  writeFileSync(`.shots/seam-${name}.png`, Buffer.from(shot.data, 'base64'));
}

const check = (ok, label, detail = '') => {
  if (!ok) failures++;
  console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${label}${detail ? `  — ${detail}` : ''}`);
};

/* ---- The hanging backend -------------------------------------------------------------- */

/** Accepts the connection, sends nothing, ever. The worst realistic backend failure. */
const blackhole = createServer(() => {
  /* deliberately no response */
});
blackhole.listen(BLACKHOLE_PORT);

/* ---- Driving the app ------------------------------------------------------------------ */

function startVite(env) {
  const child = spawn('npx', ['vite', '--port', String(VITE_PORT), '--strictPort'], {
    env: { ...process.env, ...env },
    stdio: 'ignore',
  });
  return child;
}

/**
 * Calls every endpoint in the contract through the app's own api.ts, and reports what
 * came back. Runs inside the page, so it exercises the shipped code path exactly.
 */
const EXERCISE_CONTRACT = `(async () => {
  const api = await import('/src/lib/api.ts');
  const started = performance.now();
  const results = {};
  const record = async (name, run) => {
    const t0 = performance.now();
    try {
      const value = await run();
      results[name] = { ok: true, ms: Math.round(performance.now() - t0), value };
    } catch (error) {
      results[name] = { ok: false, ms: Math.round(performance.now() - t0), error: String(error) };
    }
  };

  await record('health', () => api.getHealth());
  await record('city', () => api.getCity('kochi'));
  await record('forecast', () => api.getForecast({ city: 'kochi', hazard: 'flood', intensity: 62 }));
  await record('threshold', () => api.postThreshold({
    city: 'kochi', zoneId: 'kaloor', hazard: 'flood', intensity: 62,
    profile: { buildingType: 'independent', floorLevel: 0, householdSize: 4,
      hasElderly: true, hasLimitedMobility: true, hasVehicle: false, language: 'ml' },
  }));
  await record('requests', () => api.postRequest({
    type: 'rescue', urgency: 'critical', lat: 9.997, lng: 76.299,
    createdAt: '2026-08-18T10:00:00Z', clientId: 'verify-seam-fixed-client-id',
  }));
  await record('intake', () => api.postVoiceIntake(new Blob([new Uint8Array(2048)]), { lang: 'ml' }));
  await record('shelters', () => api.getShelters({ city: 'kochi', lat: 9.997, lng: 76.299 }));
  await record('nearby', () => api.getNearby({ lat: 9.997, lng: 76.299 }));

  return JSON.stringify({
    mode: api.MODE,
    status: api.getStatus(),
    breaker: api.breakerState(),
    totalMs: Math.round(performance.now() - started),
    results,
    chip: document.querySelector('[data-status]')?.textContent?.trim() ?? null,
  });
})()`;

/** The fields each endpoint must come back with — the contract, restated as a checklist. */
const REQUIRED = {
  health: ['status', 'version', 'hazards', 'cities'],
  city: ['id', 'name', 'hazards', 'center', 'zones'],
  forecast: ['generatedAt', 'city', 'hazard', 'unit', 'intensity', 'source', 'bands', 'frames'],
  threshold: ['level', 'exposure', 'unit', 'threshold', 'crossesAtMin', 'leadTimeMin', 'action', 'action_ml', 'reasons'],
  requests: ['id', 'status', 'clientId'],
  intake: ['transcript', 'language', 'structured'],
  shelters: ['shelters'],
  nearby: ['services'],
};

function checkContract(results, { maxMs }) {
  for (const [name, fields] of Object.entries(REQUIRED)) {
    const result = results[name];
    if (!result?.ok) {
      check(false, `${name} returned data`, result?.error ?? 'missing');
      continue;
    }
    const missing = fields.filter((field) => !(field in (result.value ?? {})));
    check(missing.length === 0, `${name} matches the contract shape`, missing.length ? `missing ${missing.join(', ')}` : `${result.ms}ms`);
    check(result.ms <= maxMs, `${name} answered within ${maxMs}ms`, `${result.ms}ms`);
  }
}

/* ---- Phases ---------------------------------------------------------------------------- */

async function phase(title, env, body) {
  console.log(`\n${title}`);
  const vite = startVite(env);
  const chrome = launchChrome({ port: CDP_PORT, profile: '.shots/.chrome-seam' });
  try {
    await waitForServer(ORIGIN);
    const target = await pageTarget(CDP_PORT);
    const cdp = await connect(target.webSocketDebuggerUrl);
    await cdp.send('Page.enable');
    await cdp.send('Network.enable');
    await body(cdp);
    cdp.close();
  } finally {
    chrome.kill();
    vite.kill();
    // Let the port go before the next phase claims it.
    await wait(500);
  }
}

// Phase 1 + 2 + 3: the API exists but is a black hole, then the network is cut entirely.
await phase(
  `1. Backend hanging (accepts, never answers) at ${BLACKHOLE}`,
  { VITE_API_MODE: 'auto', VITE_API_BASE: BLACKHOLE },
  async (cdp) => {
    await cdp.send('Page.navigate', { url: ORIGIN });
    await wait(1200);

    const report = JSON.parse(await evaluate(cdp, EXERCISE_CONTRACT));
    check(report.mode === 'auto', "MODE resolves to 'auto' when an API base is set", report.mode);
    // Each call must give up at the 2s timeout, so allow a little scheduling headroom.
    checkContract(report.results, { maxMs: 2600 });
    check(report.status === 'simulated', "status flipped to 'simulated'", report.status);
    check(
      report.results.forecast?.value?.source === 'fallback',
      "forecast reports source 'fallback', not 'model'",
      report.results.forecast?.value?.source,
    );
    // The breaker is the difference between one slow screen and a slow whole app.
    check(report.breaker.open, 'the circuit breaker opened after repeated failures');
    check(
      report.totalMs < 6000,
      'eight endpoints against a hanging backend cost seconds, not 8 x 2s',
      `${report.totalMs}ms total`,
    );

    console.log('\n2. The status is visible to the resident');
    const chip = await evaluate(cdp, `document.querySelector('[data-status]')?.textContent?.trim() ?? null`);
    const chipLabel = await evaluate(cdp, `document.querySelector('[data-status]')?.getAttribute('aria-label') ?? null`);
    check(chip === 'Simulated data', 'the chip reads "Simulated data"', String(chip));
    check(Boolean(chipLabel?.includes('not a live feed')), 'the chip has an accessible name explaining the consequence', String(chipLabel));
    await capture(cdp, 'simulated');

    console.log('\n3. Network disabled entirely at the browser');
    await cdp.send('Network.emulateNetworkConditions', {
      offline: true, latency: 0, downloadThroughput: -1, uploadThroughput: -1,
    });
    // Let the app's own 'offline' listener run.
    await evaluate(cdp, `(async () => { window.dispatchEvent(new Event('offline')); await new Promise(r => setTimeout(r, 50)); })()`);

    const offlineReport = JSON.parse(await evaluate(cdp, EXERCISE_CONTRACT));
    checkContract(offlineReport.results, { maxMs: 2600 });
    check(offlineReport.status === 'offline', "status reads 'offline'", offlineReport.status);
    const offlineChip = await evaluate(cdp, `document.querySelector('[data-status]')?.textContent?.trim() ?? null`);
    check(offlineChip === 'Offline', 'the chip reads "Offline"', String(offlineChip));
    await capture(cdp, 'offline');
  },
);

// Phase 4: no backend configured at all — the state a fresh checkout and the demo run in.
await phase('\n4. No backend configured at all (the demo default)', { VITE_API_MODE: '', VITE_API_BASE: '' }, async (cdp) => {
  const apiRequests = [];
  cdp.on('Network.requestWillBeSent', ({ request }) => {
    // Anything that is not the dev server itself would be a call we failed to prevent.
    if (!request.url.startsWith(ORIGIN) && !request.url.startsWith('data:')) apiRequests.push(request.url);
  });

  await cdp.send('Page.navigate', { url: ORIGIN });
  await wait(1200);

  const report = JSON.parse(await evaluate(cdp, EXERCISE_CONTRACT));
  check(report.mode === 'mock', "MODE resolves to 'mock' with no API base", report.mode);
  checkContract(report.results, { maxMs: 250 });
  check(report.status === 'simulated', "status reads 'simulated'", report.status);
  check(apiRequests.length === 0, 'the browser made ZERO off-origin requests', apiRequests.join(', ') || 'none');

  // Determinism, in the browser, not just in the test runner.
  const twice = JSON.parse(await evaluate(cdp, EXERCISE_CONTRACT));
  check(
    JSON.stringify(report.results.forecast.value) === JSON.stringify(twice.results.forecast.value),
    'the same forecast is returned on a second call',
  );
});

blackhole.close();
console.log(`\n${failures === 0 ? 'ALL CHECKS PASSED — the app runs with the backend switched off.' : `${failures} CHECK(S) FAILED`}`);
process.exit(failures ? 1 : 0);
