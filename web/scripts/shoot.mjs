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
import { spawn } from 'node:child_process';
import { mkdirSync, writeFileSync, rmSync } from 'node:fs';

const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const ORIGIN = process.env.SHOOT_ORIGIN ?? 'http://localhost:5173';
const PORT = 9222;
const WIDTHS = [
  { name: 'phone', width: 390, height: 844 },
  { name: 'desktop', width: 1440, height: 900 },
];
const paths = process.argv.slice(2).length ? process.argv.slice(2) : ['/'];

const profile = `.shots/.chrome-profile`;
rmSync(profile, { recursive: true, force: true });
mkdirSync('.shots', { recursive: true });

const chrome = spawn(CHROME, [
  '--headless',
  '--disable-gpu',
  '--hide-scrollbars',
  `--remote-debugging-port=${PORT}`,
  `--user-data-dir=${profile}`,
  'about:blank',
]);
chrome.on('error', (e) => {
  console.error('could not start Chrome:', e.message);
  process.exit(1);
});

/** Poll until the DevTools endpoint answers, then return the page target. */
async function target() {
  for (let attempt = 0; attempt < 50; attempt++) {
    try {
      const list = await (await fetch(`http://127.0.0.1:${PORT}/json/list`)).json();
      const page = list.find((t) => t.type === 'page');
      if (page) return page;
    } catch {
      /* not up yet */
    }
    await new Promise((r) => setTimeout(r, 100));
  }
  throw new Error('Chrome DevTools endpoint never came up');
}

/** Minimal CDP client: send(method, params) -> result. */
function connect(url) {
  const socket = new WebSocket(url);
  const pending = new Map();
  let nextId = 1;
  socket.addEventListener('message', (event) => {
    const message = JSON.parse(event.data);
    const waiter = pending.get(message.id);
    if (!waiter) return;
    pending.delete(message.id);
    message.error ? waiter.reject(new Error(message.error.message)) : waiter.resolve(message.result);
  });
  const ready = new Promise((resolve) => socket.addEventListener('open', resolve));
  return {
    ready,
    send(method, params = {}) {
      const id = nextId++;
      socket.send(JSON.stringify({ id, method, params }));
      return new Promise((resolve, reject) => pending.set(id, { resolve, reject }));
    },
    close: () => socket.close(),
  };
}

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

const page = await target();
const cdp = connect(page.webSocketDebuggerUrl);
await cdp.ready;
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
    await new Promise((r) => setTimeout(r, 900));

    const probe = await cdp.send('Runtime.evaluate', {
      expression: OVERFLOW_PROBE,
      returnByValue: true,
    });
    const { viewport, scrollWidth, wide } = JSON.parse(probe.result.value);
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
