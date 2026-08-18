/* Which libraries ended up in which chunk.
 *
 * CLAUDE.md §5 scopes the animation engines: motion.dev on functional surfaces, GSAP,
 * Lenis and Rive only inside lazily-loaded marketing routes. A leak is a bug even when
 * nothing on screen uses it, and it is invisible in source review — an import three
 * modules deep pulls the whole library into the functional bundle.
 *
 * Checked against distinctive identifiers, not bare package names: grepping for "rive"
 * matches "arrive", "driven" and "getDerivedStateFromProps", which is how an earlier
 * version of this check reported a leak that did not exist.
 *
 * Run: npm run build && npm run verify:bundles
 */
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

const DIST = 'dist/assets';

/** Signatures that only appear if the library itself was bundled. */
const RESTRICTED = [
  { name: 'gsap', signatures: ['gsap.registerPlugin', 'ScrollTrigger', '_gsapVersion', 'gsap.timeline'] },
  { name: 'lenis', signatures: ['new Lenis', 'lenis/dist', 'lenisVersion', '__lenis'] },
  { name: 'rive', signatures: ['@rive-app', 'RiveCanvas', 'rive_fallback', 'useRive'] },
];

/** Chunks a resident on the dashboard or the emergency path actually downloads. */
const FUNCTIONAL = /^index-|^setup-|^levels-|^ForecastSparkline-/;

const files = readdirSync(DIST).filter((f) => f.endsWith('.js'));
let failures = 0;

console.log('chunk sizes:');
for (const file of files.sort()) {
  const source = readFileSync(join(DIST, file), 'utf8');
  const kb = (source.length / 1024).toFixed(0).padStart(5);
  const functional = FUNCTIONAL.test(file);
  const found = RESTRICTED.filter((lib) => lib.signatures.some((sig) => source.includes(sig)));

  console.log(`  ${kb} KB  ${functional ? '[functional]' : '[lazy]      '}  ${file}`);

  for (const lib of found) {
    if (functional) {
      failures++;
      console.log(`         FAIL  ${lib.name} is in a functional chunk`);
    } else {
      console.log(`         note  ${lib.name} present (lazy chunk — allowed)`);
    }
  }
}

console.log(
  failures === 0
    ? '\nPASS  no restricted animation library is in a functional chunk.'
    : `\n${failures} leak(s) into functional chunks.`,
);
process.exit(failures ? 1 : 0);
