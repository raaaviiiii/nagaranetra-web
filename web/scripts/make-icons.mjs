/* Generates the PWA icons as PNGs, from the tokens — so the app icon can never
 * drift from the palette, and so no binary enters the repo that we cannot regenerate.
 *
 * The mark is the signature element (CLAUDE.md §5): a threshold line on ink, with the
 * marker sitting just above it in warning red.
 *
 * Run: node scripts/make-icons.mjs
 */
import { deflateSync } from 'node:zlib';
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const tokens = readFileSync(join(here, '../src/styles/tokens.css'), 'utf8');

/** Read one `--name: #RRGGBB;` out of tokens.css so this file holds no colour of its own. */
function token(name) {
  const hit = tokens.match(new RegExp(`--${name}:\\s*(#[0-9A-Fa-f]{6})`));
  if (!hit) throw new Error(`token --${name} not found in tokens.css`);
  const n = parseInt(hit[1].slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

const INK = token('ink');
const PAPER = token('paper');
const WARNING = token('level-warning');

/** CRC-32, needed for PNG chunk framing. */
const CRC_TABLE = Uint32Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});
function crc32(buf) {
  let c = 0xffffffff;
  for (const b of buf) c = CRC_TABLE[(c ^ b) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}
function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, 'latin1'), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([len, body, crc]);
}

/** 8-bit RGB PNG from a `paint(x, y) -> [r,g,b]` function. */
function png(size, paint) {
  // One filter byte (0 = None) per scanline, then RGB triplets.
  const raw = Buffer.alloc(size * (size * 3 + 1));
  let p = 0;
  for (let y = 0; y < size; y++) {
    raw[p++] = 0;
    for (let x = 0; x < size; x++) {
      const [r, g, b] = paint(x, y);
      raw[p++] = r;
      raw[p++] = g;
      raw[p++] = b;
    }
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 2; // colour type: truecolour
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

/** The mark. Coordinates are fractions of the icon, so every size is identical. */
function mark(size) {
  const line = Math.round(size * 0.62); // the threshold, low in the frame
  const weight = Math.max(2, Math.round(size * 0.045));
  const inset = Math.round(size * 0.18);
  const markerX = Math.round(size * 0.66); // the forecast, sitting above the line
  const markerW = Math.max(3, Math.round(size * 0.07));
  const markerTop = Math.round(size * 0.34);

  return (x, y) => {
    const withinRun = x >= inset && x < size - inset;
    if (withinRun && y >= line && y < line + weight) return PAPER;
    if (x >= markerX && x < markerX + markerW && y >= markerTop && y < line) return WARNING;
    return INK;
  };
}

for (const size of [192, 512]) {
  const out = join(here, `../public/icon-${size}.png`);
  writeFileSync(out, png(size, mark(size)));
  console.log(`wrote public/icon-${size}.png`);
}

/* The favicon is the same mark as vector, drawn from the same fractions and the
 * same tokens, so the tab icon and the installed icon can never disagree. */
const hex = (c) => '#' + c.map((v) => v.toString(16).padStart(2, '0')).join('');
const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" role="img" aria-label="Nagaranetra">
  <rect width="100" height="100" fill="${hex(INK)}"/>
  <rect x="66" y="34" width="7" height="28" fill="${hex(WARNING)}"/>
  <rect x="18" y="62" width="64" height="4.5" fill="${hex(PAPER)}"/>
</svg>
`;
writeFileSync(join(here, '../public/favicon.svg'), svg);
console.log('wrote public/favicon.svg');
