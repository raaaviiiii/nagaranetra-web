/* Fetch the basemap geometry from OpenStreetMap and commit it.
 *
 * WHY THIS EXISTS. CLAUDE.md §5 calls for Leaflet with self-hosted tiles, and offline is a
 * product requirement. Raster tiles from OSM's public servers are not an option — their
 * tile usage policy forbids bulk downloading, and a demo that leans on a third-party tile
 * server dies the moment the venue WiFi does.
 *
 * So we self-host the geometry rather than pictures of it: one Overpass query per city,
 * committed as GeoJSON, rendered as vectors by Leaflet. That is genuinely offline, it is a
 * legitimate use of Overpass (one area query, not a tile scrape), and it is the same OSM
 * data the 3D scene needs in §6 — one source feeding both.
 *
 * Data © OpenStreetMap contributors, ODbL. The attribution is rendered on the map.
 *
 * Run: npm run basemap
 */
import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const ENDPOINT = 'https://overpass-api.de/api/interpreter';

/** Cities to fetch, with a bounding box comfortably around their wards. */
const CITIES = [
  { id: 'kochi', south: 9.905, west: 76.225, north: 10.055, east: 76.345 },
  // Tighter than the district: the wards sit in this box, and a wider query times out on
  // the public Overpass instance.
  { id: 'wayanad', south: 11.52, west: 75.94, north: 11.83, east: 76.29 },
];

/**
 * Road classes worth drawing at city scale. Service roads and footpaths triple the file
 * size and add nothing you can read at this zoom.
 */
const ROAD_CLASSES = 'motorway|trunk|primary|secondary|tertiary|residential|unclassified';

/** Which of our three drawing weights a road belongs to. */
function roadClass(highway) {
  if (/^(motorway|trunk)/.test(highway)) return 'major';
  if (/^(primary|secondary)/.test(highway)) return 'arterial';
  return 'street';
}

const query = ({ south, west, north, east }) => `
[out:json][timeout:180];
(
  way["highway"~"^(${ROAD_CLASSES})$"](${south},${west},${north},${east});
  way["natural"="water"](${south},${west},${north},${east});
  way["waterway"="riverbank"](${south},${west},${north},${east});
  relation["natural"="water"](${south},${west},${north},${east});
  // The sea is not tagged as water — it is whatever lies outside the coastline. Without
  // this, Kochi renders as a road mesh floating on blank paper and the peninsula that
  // makes the city recognisable is simply absent.
  way["natural"="coastline"](${south},${west},${north},${east});
);
out geom;`;

/** ~11 m of precision. At the zooms this map is read at, more is invisible and costs size. */
const round = (n) => Math.round(n * 1e4) / 1e4;

/**
 * Ramer–Douglas–Peucker. The raw extract was 2.7 MB for one city, which is not something
 * to ship to a phone that has to work offline during a flood. Dropping points that sit
 * within ~15 m of the line they are on takes most of that away and changes nothing you
 * can see at ward scale.
 */
function simplify(points, tolerance) {
  if (points.length < 3) return points;

  let index = 0;
  let maxDistance = 0;
  const [startLat, startLng] = points[0];
  const [endLat, endLng] = points[points.length - 1];

  for (let i = 1; i < points.length - 1; i++) {
    const [lat, lng] = points[i];
    // Perpendicular distance in degrees, with longitude scaled by latitude so the
    // measure is roughly metric this close to the equator.
    const scale = Math.cos((startLat * Math.PI) / 180);
    const dx = (endLng - startLng) * scale;
    const dy = endLat - startLat;
    const length = Math.hypot(dx, dy);
    const distance =
      length === 0
        ? Math.hypot((lng - startLng) * scale, lat - startLat)
        : Math.abs(dx * (startLat - lat) - (startLng - lng) * scale * dy) / length;
    if (distance > maxDistance) {
      index = i;
      maxDistance = distance;
    }
  }

  if (maxDistance <= tolerance) return [points[0], points[points.length - 1]];
  return [
    ...simplify(points.slice(0, index + 1), tolerance).slice(0, -1),
    ...simplify(points.slice(index), tolerance),
  ];
}

/** ~15 m, expressed in degrees. */
const TOLERANCE = 15 / 111_320;

/**
 * One Overpass call, with backoff. The public instance answers 504 when it is busy, and a
 * shared free service deserves patience rather than a retry storm.
 */
async function request(city) {
  for (let attempt = 1; attempt <= 4; attempt++) {
    const response = await fetch(ENDPOINT, {
      method: 'POST',
      headers: {
        'content-type': 'application/x-www-form-urlencoded',
        // Overpass answers 406 without a real User-Agent, and it is good manners on a
        // shared free service to say who is calling.
        'user-agent': 'nagaranetra-web/0.1 (hackathon project; basemap fetch, run rarely)',
        accept: 'application/json',
      },
      body: new URLSearchParams({ data: query(city) }),
    });
    if (response.ok) return response;
    if (response.status !== 504 && response.status !== 429) return response;
    const wait = attempt * 20;
    process.stdout.write(`(${response.status}, retrying in ${wait}s) `);
    await new Promise((r) => setTimeout(r, wait * 1000));
  }
  throw new Error('Overpass stayed busy after four attempts');
}

async function fetchCity(city) {
  process.stdout.write(`${city.id}: querying Overpass… `);
  const response = await request(city);
  if (!response.ok) throw new Error(`Overpass responded ${response.status}`);
  const body = await response.json();

  const roads = { major: [], arterial: [], street: [] };
  const water = [];
  const shore = [];

  /* A way carries one geometry; a relation carries one per member, and flattening them
     into a single list welds unrelated rings into one nonsense outline. */
  const parts = (element) =>
    element.geometry
      ? [element.geometry]
      : (element.members ?? []).map((member) => member.geometry).filter(Boolean);

  for (const element of body.elements) {
    for (const geometry of parts(element)) {
    if (!geometry || geometry.length < 2) continue;
    // [lat, lng] pairs — the order Leaflet takes directly, so nothing is transposed later.
    const line = simplify(
      geometry.map((point) => [point.lat, point.lon]),
      TOLERANCE,
    ).map(([lat, lng]) => [round(lat), round(lng)]);
    if (line.length < 2) continue;

    const tags = element.tags ?? {};
    if (tags.highway) {
      roads[roadClass(tags.highway)].push(line);
      continue;
    }

    // The coastline is a line, not an area: drawn as a stroke it gives the city its shape.
    if (tags.natural === 'coastline') {
      shore.push(line);
      continue;
    }

    // Water has to be a closed ring to be fillable. Overpass returns riverbank ways as
    // open fragments and members of multipolygons as single points; drawing those gave
    // 1141 "polygons", most of them degenerate, and no visible water at all.
    const [firstLat, firstLng] = line[0];
    const [lastLat, lastLng] = line[line.length - 1];
    const closed = firstLat === lastLat && firstLng === lastLng;
    if (closed && line.length >= 5) water.push(line);
    }
  }

  const out = {
    attribution: 'Map data © OpenStreetMap contributors (ODbL)',
    fetchedAt: new Date().toISOString().slice(0, 10),
    bbox: [city.south, city.west, city.north, city.east],
    water,
    shore,
    roads,
  };

  const file = join(here, `../public/data/basemap-${city.id}.json`);
  const json = JSON.stringify(out);
  writeFileSync(file, json);
  console.log(
    `${(json.length / 1024).toFixed(0)} KB — ` +
      `${roads.major.length} major, ${roads.arterial.length} arterial, ` +
      `${roads.street.length} street, ${water.length} water, ${shore.length} shore`,
  );
}

/* Fetch only what a screen actually renders. Wayanad's landslide scenario has no map yet,
   and committing its basemap would add ~860 KB to the offline precache for nothing.
   Pass an id to fetch it: `npm run basemap -- wayanad`. */
const wanted = process.argv.slice(2);
const selected = wanted.length ? CITIES.filter((c) => wanted.includes(c.id)) : CITIES.filter((c) => c.id === 'kochi');

for (const city of selected) {
  await fetchCity(city);
  // Overpass is a shared free service. Do not hammer it.
  await new Promise((r) => setTimeout(r, 2000));
}
