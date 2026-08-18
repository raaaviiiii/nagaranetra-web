/* Accessibility checks that only a browser can answer (CLAUDE.md §2).
 *
 * Three things this proves, on the styleguide, because that is where every component is:
 *   1. prefers-reduced-motion actually drops movement — not "we wrote a media query", but
 *      the needle lands on its value immediately instead of springing to it.
 *   2. Every interactive element has an accessible name.
 *   3. Keyboard focus is visible on the signature element's control and on a button.
 *
 * Run: npm run verify:a11y   (needs the dev server up)
 */
import { writeFileSync } from 'node:fs';
import { connect, evaluate, launchChrome, pageTarget, wait, waitForServer } from './cdp.mjs';

const ORIGIN = process.env.SHOOT_ORIGIN ?? 'http://localhost:5173';
const PORT = 9445;

let failures = 0;
const check = (ok, label, detail = '') => {
  if (!ok) failures++;
  console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${label}${detail ? `  — ${detail}` : ''}`);
};

await waitForServer(ORIGIN);
const chrome = launchChrome({ port: PORT, profile: '.shots/.chrome-a11y' });
const target = await pageTarget(PORT);
const cdp = await connect(target.webSocketDebuggerUrl);
await cdp.send('Page.enable');
await cdp.send('DOM.enable');
await cdp.send('Accessibility.enable');
await cdp.send('Emulation.setDeviceMetricsOverride', { width: 1280, height: 900, deviceScaleFactor: 1, mobile: false });

/** Move the scrubber, then read the needle's transform this frame and 400ms later. */
/**
 * Move the scrubber, then sample the needle's transform across the whole settle.
 * A spring passes through many intermediate positions; a jump produces one step. Counting
 * distinct positions is the difference, and it does not depend on sampling at exactly the
 * right instant — which an earlier version of this check got wrong.
 */
const NEEDLE_PROBE = `(async () => {
  const scrub = document.getElementById('scrub');
  const setValue = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
  const read = () => {
    const el = document.querySelector('#clause-3 [data-role="needle"]');
    if (!el) return null;
    const m = new DOMMatrixReadOnly(getComputedStyle(el).transform);
    return Math.round(m.m41 * 10) / 10;
  };

  const before = read();
  setValue.call(scrub, '68');
  scrub.dispatchEvent(new Event('input', { bubbles: true }));

  const samples = [];
  for (let i = 0; i < 40; i++) {
    samples.push(read());
    await new Promise((r) => setTimeout(r, 20));
  }
  const after = read();
  const distinct = [...new Set(samples)];
  return JSON.stringify({ before, after, distinctPositions: distinct.length, moved: before !== after });
})()`;

console.log('\n1. Motion — prefers-reduced-motion: no-preference');
// Set explicitly rather than trusting the default: headless Chrome reports `reduce` on its
// own, which would make this phase silently test the same thing as phase 2.
await cdp.send('Emulation.setEmulatedMedia', {
  features: [{ name: 'prefers-reduced-motion', value: 'no-preference' }],
});
await cdp.send('Page.navigate', { url: `${ORIGIN}/styleguide` });
await wait(1400);
const normal = JSON.parse(await evaluate(cdp, NEEDLE_PROBE));
check(normal.moved, 'the needle reaches its new value', `${normal.before} -> ${normal.after}`);
check(
  normal.distinctPositions >= 5,
  'the needle travels through intermediate positions (a spring, not a jump)',
  `${normal.distinctPositions} distinct positions`,
);

console.log('\n2. Motion — prefers-reduced-motion: reduce');
await cdp.send('Emulation.setEmulatedMedia', {
  features: [{ name: 'prefers-reduced-motion', value: 'reduce' }],
});
await cdp.send('Page.navigate', { url: `${ORIGIN}/styleguide` });
await wait(1400);
const reduced = JSON.parse(await evaluate(cdp, NEEDLE_PROBE));
check(reduced.moved, 'the needle still reaches its new value', `${reduced.before} -> ${reduced.after}`);
check(
  reduced.distinctPositions <= 2,
  'the needle jumps rather than travelling — movement is dropped',
  `${reduced.distinctPositions} distinct positions`,
);
// Opacity and colour must survive: the fill is still painted and still coloured.
const stillColoured = await evaluate(
  cdp,
  `(() => { const fill = document.querySelector('#clause-3 [data-role="fill"]');
     const c = fill && getComputedStyle(fill).backgroundColor;
     return c && c !== 'rgba(0, 0, 0, 0)'; })()`,
);
check(Boolean(stillColoured), 'the level colour survives reduced motion');
await cdp.send('Emulation.setEmulatedMedia', { features: [] });

/** Register a household, so the dashboard under test is the real one and not the empty state. */
async function seedHousehold() {
  await cdp.send('Page.navigate', { url: `${ORIGIN}/` });
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
}
await seedHousehold();

console.log('\n3. Accessible names on every interactive element');
for (const path of ['/styleguide', '/setup', '/']) {
await cdp.send('Page.navigate', { url: `${ORIGIN}${path}` });
await wait(1400);
const unnamed = JSON.parse(
  await evaluate(
    cdp,
    `(() => {
       const nodes = [...document.querySelectorAll('button, a[href], input, select, textarea, [role="meter"]')];
       const bad = nodes.filter((el) => {
         const name = (el.getAttribute('aria-label') || el.getAttribute('aria-labelledby') ||
           el.textContent || '').trim();
         const labelled = el.labels && el.labels.length > 0;
         return !name && !labelled;
       }).map((el) => el.tagName.toLowerCase() + (el.id ? '#' + el.id : '') + '.' + (el.className || '').toString().slice(0, 30));
       return JSON.stringify({ total: nodes.length, bad });
     })()`,
  ),
);
check(unnamed.bad.length === 0, `${path}: all ${unnamed.total} interactive elements have an accessible name`, unnamed.bad.join(', '));
}

console.log('\n4. Keyboard navigation — every stop in the tab order');

/** Press Tab for real, so focus is genuinely keyboard-driven and :focus-visible applies. */
async function pressTab() {
  await cdp.send('Input.dispatchKeyEvent', {
    type: 'rawKeyDown', windowsVirtualKeyCode: 9, nativeVirtualKeyCode: 9, key: 'Tab', code: 'Tab',
  });
  await cdp.send('Input.dispatchKeyEvent', {
    type: 'keyUp', windowsVirtualKeyCode: 9, nativeVirtualKeyCode: 9, key: 'Tab', code: 'Tab',
  });
}

const DESCRIBE_FOCUS = `(() => {
  const el = document.activeElement;
  if (!el || el === document.body) return JSON.stringify({ end: true });
  const s = getComputedStyle(el);
  const width = s.outlineStyle !== 'none' ? parseFloat(s.outlineWidth) || 0 : 0;
  return JSON.stringify({
    tag: el.tagName.toLowerCase() + (el.id ? '#' + el.id : ''),
    name: (el.getAttribute('aria-label') || el.textContent || '').trim().slice(0, 40),
    focusVisible: el.matches(':focus-visible'),
    ringWidth: width,
  });
})()`;

/** Walk the whole tab order of a page and report every stop. */
async function tabThrough(path) {
  await cdp.send('Page.navigate', { url: `${ORIGIN}${path}` });
  await wait(1500);
  await evaluate(cdp, 'window.scrollTo(0, 0); document.body.focus();');
  const seen = [];
  for (let i = 0; i < 60; i++) {
    await pressTab();
    const info = JSON.parse(await evaluate(cdp, DESCRIBE_FOCUS));
    if (info.end) break;
    if (seen.some((s) => s.tag === info.tag && s.name === info.name)) break; // wrapped around
    seen.push(info);
  }
  const invisible = seen.filter((s) => !s.focusVisible || s.ringWidth < 2);
  check(seen.length > 0, `${path}: tab order reaches ${seen.length} elements`);
  check(
    invisible.length === 0,
    `${path}: every focused element shows a ring of at least 2px`,
    invisible.map((s) => `${s.tag} "${s.name}" ring=${s.ringWidth}px`).join(' | '),
  );
  return seen;
}

const styleguideStops = await tabThrough('/styleguide');
await tabThrough('/setup');
const dashboardStops = await tabThrough('/');

// The two controls called out specifically: the signature element's scrubber, and the
// emergency request that has to be reachable without a mouse.
check(
  styleguideStops.some((s) => s.tag === 'input#scrub'),
  'the threshold line scrubber is reachable by keyboard',
);
check(
  dashboardStops.some((s) => (s.name || '').includes('Get help')),
  'the emergency request is reachable by keyboard from the dashboard',
);

// A picture, because "outline-width: 2px" and "you can see it" are different claims.
await cdp.send('Page.navigate', { url: `${ORIGIN}/` });
await wait(1500);
await evaluate(cdp, 'window.scrollTo(0, 0); document.body.focus();');
for (let i = 0; i < 30; i++) {
  await pressTab();
  const info = JSON.parse(await evaluate(cdp, DESCRIBE_FOCUS));
  if (info.end || (info.name || '').includes('Get help')) break;
}
await evaluate(cdp, `document.activeElement.scrollIntoView({ block: 'center' })`);
await wait(300);
const shot = await cdp.send('Page.captureScreenshot', { format: 'png' });
writeFileSync('.shots/a11y-focus.png', Buffer.from(shot.data, 'base64'));
console.log('  wrote .shots/a11y-focus.png');

cdp.close();
chrome.kill();
console.log(`\n${failures === 0 ? 'ALL ACCESSIBILITY CHECKS PASSED' : `${failures} CHECK(S) FAILED`}`);
process.exit(failures ? 1 : 0);
