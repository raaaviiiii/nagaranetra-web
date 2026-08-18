/**
 * Pin your home, on a real map.
 *
 * WHAT WAS WRONG BEFORE. There was no basemap at all — ward dots on an empty field with
 * labels colliding on the markers. That was not a styling problem: the basemap had never
 * been wired up, and the reason given for it ("tiles come from a CDN and offline is a
 * requirement") was a true statement used to justify shipping nothing.
 *
 * WHAT IT IS NOW. Self-hosted geometry rather than self-hosted pictures of geometry. One
 * Overpass query per city, committed to public/data as coordinates, drawn by Leaflet as
 * vectors from our own tokens (scripts/fetch-basemap.mjs). That is a real map with real
 * streets and the actual backwaters, it works with the network off, the service worker
 * precaches it, and it is the same OSM data the 3D scene needs in §6 — one source feeding
 * both. Raster tiles were never available: OSM's tile policy forbids bulk downloading, and
 * a demo leaning on someone else's tile server dies with the venue WiFi.
 *
 * Roads are drawn in three weights so a city reads as a city rather than as a mesh, and
 * water is filled, because in Kochi the water is what you recognise.
 *
 * Data © OpenStreetMap contributors, ODbL — credited on the map.
 */
import { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import type { City, Zone } from '../../lib/contract';
import { distanceM } from '../../lib/mock';
import { readToken } from '../../lib/contrast';
import { Button } from '../Button';
import { Select } from '../Select';

export type PinnedPlace = { lat: number; lng: number; zone: Zone };

/** Which zone a point belongs to. Nearest centre is enough at ward scale. */
export function zoneAt(city: City, lat: number, lng: number): Zone {
  return city.zones.reduce((closest, zone) =>
    distanceM({ lat, lng }, zone) < distanceM({ lat, lng }, closest) ? zone : closest,
  );
}

type Line = Array<[number, number]>;
type Basemap = {
  attribution: string;
  water: Line[];
  /** Coastline, drawn as a stroke — it is what gives Kochi its recognisable shape. */
  shore?: Line[];
  roads: { major: Line[]; arterial: Line[]; street: Line[] };
};

type GeolocationState = 'idle' | 'locating' | 'denied' | 'unavailable' | 'located';

/**
 * Weights chosen so the hierarchy survives at ward zoom without turning into a hairball.
 *
 * These are drawn on a CANVAS, not as SVG. The extract has roughly 13,000 road segments,
 * and one SVG path each is 13,000 DOM nodes — which pans nowhere near the 60fps CLAUDE.md
 * §6 asks for on a mid-range phone. Canvas draws them as one surface.
 *
 * The cost of canvas is that CSS cannot reach the features, so the colours are read out of
 * the tokens at mount instead. They must not be passed as `var(--map-road)` either way:
 * Leaflet writes that into an SVG presentation attribute where var() does not resolve, and
 * the silent fallback is Leaflet's default blue — the one colour this product must never
 * show by accident.
 */
const ROAD_STYLE = {
  street: { weight: 0.6, opacity: 0.42 },
  arterial: { weight: 1.3, opacity: 0.72 },
  major: { weight: 2.1, opacity: 1 },
} as const;

export function MapPicker({
  city,
  value,
  onChange,
}: {
  city: City;
  value: { lat: number; lng: number } | null;
  onChange: (place: PinnedPlace) => void;
}) {
  const container = useRef<HTMLDivElement>(null);
  const map = useRef<L.Map | null>(null);
  const pin = useRef<L.Marker | null>(null);
  const [geo, setGeo] = useState<GeolocationState>('idle');
  const [basemap, setBasemap] = useState<Basemap | null>(null);

  // Keep the newest handler without tearing the map down on every render.
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

  // Same-origin, so this still resolves from the service worker cache when offline.
  useEffect(() => {
    let live = true;
    void fetch(`/data/basemap-${city.id}.json`)
      .then((response) => (response.ok ? response.json() : null))
      .then((data: Basemap | null) => live && setBasemap(data))
      // A missing basemap is survivable: the pin and the ward list still work.
      .catch(() => live && setBasemap(null));
    return () => {
      live = false;
    };
  }, [city.id]);

  useEffect(() => {
    if (!container.current || map.current) return;

    const instance = L.map(container.current, {
      center: [city.center.lat, city.center.lng],
      zoom: 12,
      zoomControl: true,
      attributionControl: true,
    });
    map.current = instance;
    instance.attributionControl.setPrefix(false);

    const marker = L.marker([city.center.lat, city.center.lng], {
      draggable: true,
      keyboard: false,
      icon: L.divIcon({ className: 'ng-pin', html: '<span></span>', iconSize: [20, 20] }),
      alt: 'Your home',
      zIndexOffset: 1000,
    }).addTo(instance);
    pin.current = marker;

    const publish = (lat: number, lng: number) => {
      marker.setLatLng([lat, lng]);
      onChangeRef.current({ lat, lng, zone: zoneAt(city, lat, lng) });
    };

    marker.on('dragend', () => {
      const { lat, lng } = marker.getLatLng();
      publish(lat, lng);
    });
    instance.on('click', (event: L.LeafletMouseEvent) => publish(event.latlng.lat, event.latlng.lng));
    instance.fitBounds(L.latLngBounds(city.zones.map((z) => [z.lat, z.lng])), { padding: [28, 28] });

    return () => {
      instance.remove();
      map.current = null;
      pin.current = null;
    };
  }, [city]);

  // Draw the basemap once it has loaded.
  useEffect(() => {
    const instance = map.current;
    if (!instance || !basemap) return;

    // Read the palette from the live tokens: canvas features cannot be reached by CSS.
    const water = readToken('--map-water', container.current ?? undefined);
    const road = readToken('--map-road', container.current ?? undefined);
    const renderer = L.canvas({ padding: 0.3 });
    const layer = L.layerGroup().addTo(instance);

    for (const shape of basemap.water) {
      L.polygon(shape, {
        renderer,
        stroke: false,
        fillColor: water,
        fillOpacity: 1,
        interactive: false,
      }).addTo(layer);
    }

    for (const line of basemap.shore ?? []) {
      L.polyline(line, {
        renderer,
        color: water,
        weight: 2.5,
        opacity: 1,
        interactive: false,
      }).addTo(layer);
    }

    // Smallest first, so arterials and highways draw over the residential mesh.
    for (const kind of ['street', 'arterial', 'major'] as const) {
      for (const line of basemap.roads[kind]) {
        L.polyline(line, {
          renderer,
          color: road,
          weight: ROAD_STYLE[kind].weight,
          opacity: ROAD_STYLE[kind].opacity,
          interactive: false,
          lineJoin: 'round',
          lineCap: 'round',
        }).addTo(layer);
      }
    }

    instance.attributionControl.addAttribution(basemap.attribution);
    return () => {
      layer.remove();
      instance.attributionControl.removeAttribution(basemap.attribution);
    };
  }, [basemap]);

  // Follow an externally set value (the initial centre, or "use my location").
  useEffect(() => {
    if (!value || !pin.current) return;
    pin.current.setLatLng([value.lat, value.lng]);
  }, [value]);

  function useMyLocation() {
    if (!('geolocation' in navigator)) {
      setGeo('unavailable');
      return;
    }
    setGeo('locating');
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setGeo('located');
        const { latitude, longitude } = position.coords;
        onChangeRef.current({ lat: latitude, lng: longitude, zone: zoneAt(city, latitude, longitude) });
        map.current?.setView([latitude, longitude], 15);
      },
      // A refused lookup is a normal outcome, not an error: the pin still works.
      (error) => setGeo(error.code === error.PERMISSION_DENIED ? 'denied' : 'unavailable'),
      { enableHighAccuracy: true, timeout: 8000, maximumAge: 60_000 },
    );
  }

  const geoMessage: Record<GeolocationState, string | null> = {
    idle: null,
    locating: null,
    located: null,
    denied: 'Your browser is not sharing your location. Drag the pin, or choose your ward below.',
    unavailable: 'Could not get your location. Drag the pin, or choose your ward below.',
  };

  const selected = value ? zoneAt(city, value.lat, value.lng) : city.zones[0];

  return (
    <div>
      <div ref={container} className="ng-map" style={{ height: 'min(34vh, 320px)' }} aria-hidden="true" />

      <div style={{ marginTop: 'var(--space-md)' }}>
        <Button variant="quiet" onClick={useMyLocation} disabled={geo === 'locating'}>
          {geo === 'locating' ? 'Finding you…' : 'Use my location'}
        </Button>
      </div>

      {geoMessage[geo] && (
        <p
          role="status"
          style={{ marginTop: 'var(--space-sm)', fontSize: 'var(--size-caption)', color: 'var(--fg-muted)' }}
        >
          {geoMessage[geo]}
        </p>
      )}

      {/*
       * The keyboard and screen-reader path, and the way out when geolocation is refused.
       * A map is a pointer instrument; rather than pretend a canvas can be driven from a
       * keyboard, the same answer is available as a list. Both write the same value.
       */}
      <div style={{ marginTop: 'var(--space-md)' }}>
        <Select
          id="ward"
          label="Or choose your ward"
          value={selected.id}
          onChange={(id) => {
            const zone = city.zones.find((z) => z.id === id);
            if (!zone) return;
            onChangeRef.current({ lat: zone.lat, lng: zone.lng, zone });
            map.current?.setView([zone.lat, zone.lng], 14);
          }}
        >
          {city.zones.map((zone) => (
            <option key={zone.id} value={zone.id}>
              {zone.name}
            </option>
          ))}
        </Select>
      </div>
    </div>
  );
}
