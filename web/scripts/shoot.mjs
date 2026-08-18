/* Screenshot and measure the running app in headless Chrome.
 *
 * CLAUDE.md §8: verify by looking, and test at 390 px before declaring a screen done.
 * This drives Chrome over the DevTools Protocol directly — no Puppeteer, no dependency,
 * just the WebSocket built into Node.
 *
 * Usage:
 *   npm run dev                                  # in another terminal
 *   node scripts/shoot.mjs /styleguide /help     # paths, default "/"
 *
 * Writes PNGs to .shots/ and prints, per path and per width, the document scroll width
 * and any element wider than the viewport — the horizontal-overflow culprits.
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { connect, evaluate, launchChrome, pageTarget, wait } from './cdp.mjs';

const ORIGIN = process.env.SHOOT_ORIGIN ?? 'http://localhost:5173';
const PORT = 9222;
const WIDTHS = [
  { name: 'phone', width: 390, height: 844 },
  { name: 'desktop', width: 1440, height: 900 },
];
const paths = process.argv.slice(2).length ? process.argv.slice(2) : ['/'];

const profile = '.shots/.chrome-profile';
mkdirSync('.shots', { recursive: true });
const chrome = launchChrome({ port: PORT, profile });

/** Runs in the page: what is sticking out past the viewport? */
const OVERFLOW_PROBE = `(() => {
  const limit = document.documentElement.clientWidth;
  const wide = [...document.querySelectorAll('body *')]
    .map((el) => ({ el, right: el.getBoundingClientRect().right }))
    .filter(({ el, right }) => right > limit + 1 && getComputedStyle(el).position !== 'fixed')
    .map(({ el, right }) => {
      const id = el.id ? '#' + el.id : '';
      const cls = typeof el.className === 'string' && el.className
        ? '.' + el.className.trim().split(/\\s+/).slice(0, 3).join('.')
        : '';
      return el.tagName.toLowerCase() + id + cls + ' -> ' + Math.round(right) + 'px';
    });
  return JSON.stringify({
    viewport: limit,
    scrollWidth: document.documentElement.scrollWidth,
    wide: [...new Set(wide)].slice(0, 12),
  });
})()`;

const page = await pageTarget(PORT);
const cdp = await connect(page.webSocketDebuggerUrl);
await cdp.send('Page.enable');

let failures = 0;
for (const path of paths) {
  for (const size of WIDTHS) {
    await cdp.send('Emulation.setDeviceMetricsOverride', {
      width: size.width,
      height: size.height,
      deviceScaleFactor: 1,
      mobile: size.name === 'phone',
    });
    await cdp.send('Page.navigate', { url: ORIGIN + path });
    // Give the SPA a beat to mount and the fonts a beat to swap in.
    await wait(900);

    const { viewport, scrollWidth, wide } = JSON.parse(await evaluate(cdp, OVERFLOW_PROBE));
    const overflowing = scrollWidth > viewport + 1;
    if (overflowing) failures++;

    const shot = await cdp.send('Page.captureScreenshot', { format: 'png' });
    const file = `.shots/${size.name}${path.replace(/\//g, '-') || '-index'}.png`;
    writeFileSync(file, Buffer.from(shot.data, 'base64'));

    console.log(
      `${overflowing ? 'OVERFLOW' : 'ok      '}  ${size.name.padEnd(7)} ${path.padEnd(14)}` +
        ` viewport ${viewport}  scrollWidth ${scrollWidth}  -> ${file}`,
    );
    for (const item of wide) console.log(`            ${item}`);
  }
}

cdp.close();
chrome.kill();
process.exit(failures ? 1 : 0);
