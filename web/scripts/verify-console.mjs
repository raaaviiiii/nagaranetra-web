/* Console errors and failed requests, per screen.
 *
 * A 404 for an icon does not break a build and does not fail a typecheck — it shows up as
 * a broken image in front of a jury. This is the only check that catches that class of
 * defect, so it runs over every route.
 *
 * Run: npm run verify:console   (needs the dev server up)
 */
import { connect, evaluate, launchChrome, pageTarget, wait, waitForServer } from './cdp.mjs';

const ORIGIN = process.env.SHOOT_ORIGIN ?? 'http://localhost:5173';
const PORT = 9450;
const ROUTES = process.argv.slice(2).length ? process.argv.slice(2) : ['/', '/setup', '/styleguide', '/city'];

await waitForServer(ORIGIN);
const chrome = launchChrome({ port: PORT, profile: '.shots/.chrome-console' });
const cdp = await connect((await pageTarget(PORT)).webSocketDebuggerUrl);
await cdp.send('Page.enable');
await cdp.send('Network.enable');
await cdp.send('Runtime.enable');
await cdp.send('Log.enable');

let failures = 0;
const errors = [];
const failed = [];

cdp.on('Runtime.exceptionThrown', ({ exceptionDetails }) => {
  errors.push(exceptionDetails.exception?.description ?? exceptionDetails.text);
});
cdp.on('Runtime.consoleAPICalled', ({ type, args }) => {
  if (type === 'error') errors.push(args.map((a) => a.value ?? a.description ?? '?').join(' '));
});
cdp.on('Log.entryAdded', ({ entry }) => {
  if (entry.level === 'error') errors.push(`${entry.source}: ${entry.text} ${entry.url ?? ''}`);
});
cdp.on('Network.responseReceived', ({ response }) => {
  if (response.status >= 400) failed.push(`${response.status} ${response.url}`);
});
cdp.on('Network.loadingFailed', ({ errorText, type }) => {
  if (errorText !== 'net::ERR_ABORTED') failed.push(`${type} failed: ${errorText}`);
});

// A registered household, so the dashboard under test is the real screen.
await cdp.send('Page.navigate', { url: ORIGIN });
await wait(800);
await evaluate(cdp, `(async () => {
  const db = await new Promise((res) => { const r = indexedDB.open('nagaranetra', 1); r.onsuccess = () => res(r.result); });
  await new Promise((res) => {
    const t = db.transaction('profile', 'readwrite').objectStore('profile').put({
      id: 'household', city: 'kochi', zoneId: 'kaloor', lat: 9.997, lng: 76.299,
      buildingType: 'independent', floorLevel: 0, householdSize: 4,
      hasElderly: true, hasLimitedMobility: true, hasVehicle: false,
      language: 'ml', updatedAt: Date.now(), skipped: [],
    });
    t.onsuccess = () => res();
  });
})()`);

for (const route of ROUTES) {
  errors.length = 0;
  failed.length = 0;
  await cdp.send('Page.navigate', { url: ORIGIN + route });
  await wait(2200);

  // Images that resolved but decoded to nothing are the classic "broken icon".
  const brokenImages = JSON.parse(
    await evaluate(cdp, `JSON.stringify([...document.images]
      .filter((img) => !img.complete || img.naturalWidth === 0)
      .map((img) => img.currentSrc || img.src || '(empty src)'))`),
  );

  const clean = errors.length === 0 && failed.length === 0 && brokenImages.length === 0;
  if (!clean) failures++;
  console.log(`${clean ? 'PASS' : 'FAIL'}  ${route}`);
  for (const e of [...new Set(errors)]) console.log(`        console error: ${e.split('\n')[0]}`);
  for (const f of [...new Set(failed)]) console.log(`        request: ${f}`);
  for (const b of brokenImages) console.log(`        broken image: ${b}`);
}

cdp.close();
chrome.kill();
console.log(failures ? `\n${failures} route(s) with errors` : '\nNo console errors, no failed requests, no broken images.');
process.exit(failures ? 1 : 0);
