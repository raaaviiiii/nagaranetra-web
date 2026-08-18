/**
 * Pin your home.
 *
 * Leaflet, with NO tile layer. That is deliberate, not unfinished: street tiles would come
 * from a CDN, and offline is a product requirement (CLAUDE.md §5) — a map that goes blank
 * on hackathon WiFi is worse than a map that never pretended to have streets. Ward
 * geometry from OSM is committed to public/data later; this component picks it up the
 * moment it lands, because the only thing it needs from a basemap is orientation.
 *
 * What it does need to be right is the coordinate, and that is real: the pin's lat/lng
 * decides which zone's forecast this household gets.
 *
 * The marker is a DivIcon rather than Leaflet's default, so no image assets are fetched
 * and the pin is drawn from our own tokens.
 */
import { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import type { City, Zone } from '../../lib/contract';
import { distanceM } from '../../lib/mock';

export type PinnedPlace = { lat: number; lng: number; zone: Zone };

/** Which zone a point belongs to. Nearest centre is enough at ward scale. */
export function zoneAt(city: City, lat: number, lng: number): Zone {
  return city.zones.reduce((closest, zone) =>
    distanceM({ lat, lng }, zone) < distanceM({ lat, lng }, closest) ? zone : closest,
  );
}

type GeolocationState = 'idle' | 'locating' | 'denied' | 'unavailable' | 'located';

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
  const zoneDots = useRef<Map<string, L.CircleMarker>>(new Map());
  const [geo, setGeo] = useState<GeolocationState>('idle');

  // Keep the newest handler without tearing the map down on every render.
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

  useEffect(() => {
    if (!container.current || map.current) return;

    const instance = L.map(container.current, {
      center: [city.center.lat, city.center.lng],
      zoom: 12,
      // No tiles means no attribution to show, and the default control would be a lie.
      attributionControl: false,
      zoomControl: true,
    });
    map.current = instance;

    // The wards, so the blank field is still orientable. Only the ward the pin is in is
    // labelled: Kochi's ward centres sit close enough together that labelling all of them
    // produces a pile of overlapping text at the zoom that fits the city.
    for (const zone of city.zones) {
      const dot = L.circleMarker([zone.lat, zone.lng], {
        radius: 5,
        color: 'var(--fg-muted)',
        weight: 1,
        fillOpacity: 0.35,
        interactive: false,
      }).addTo(instance);
      dot.bindTooltip(zone.name, { permanent: false, direction: 'right', className: 'ng-zone-label' });
      // Chrome puts these SVG shapes in the tab order, which buried the real controls
      // behind ten unlabelled stops. They are decoration for pointer users; the ward
      // select below is the keyboard path.
      const element = dot.getElement();
      if (element) {
        element.setAttribute('tabindex', '-1');
        element.setAttribute('aria-hidden', 'true');
      }
      zoneDots.current.set(zone.id, dot);
    }

    const marker = L.marker([city.center.lat, city.center.lng], {
      draggable: true,
      keyboard: true,
      icon: L.divIcon({ className: 'ng-pin', html: '<span></span>', iconSize: [18, 18] }),
      alt: 'Your home',
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
    instance.on('click', (event: L.LeafletMouseEvent) => {
      publish(event.latlng.lat, event.latlng.lng);
    });

    instance.fitBounds(L.latLngBounds(city.zones.map((z) => [z.lat, z.lng])), { padding: [36, 36] });

    return () => {
      instance.remove();
      map.current = null;
      pin.current = null;
      zoneDots.current.clear();
    };
  }, [city]);

  // Follow an externally set value (initial centre, or "use my location").
  useEffect(() => {
    if (!value || !pin.current || !map.current) return;
    pin.current.setLatLng([value.lat, value.lng]);

    const inside = zoneAt(city, value.lat, value.lng);
    for (const [id, dot] of zoneDots.current) {
      if (id === inside.id) dot.openTooltip();
      else dot.closeTooltip();
    }
  }, [value, city]);

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
      },
      // A refused or failed lookup is a normal outcome, not an error state: the pin still
      // works. Say what happened and leave the person a way forward.
      (error) => setGeo(error.code === error.PERMISSION_DENIED ? 'denied' : 'unavailable'),
      { enableHighAccuracy: true, timeout: 8000, maximumAge: 60_000 },
    );
  }

  const geoMessage: Record<GeolocationState, string | null> = {
    idle: null,
    locating: 'Finding you…',
    located: null,
    denied: 'Your browser is not sharing your location. Tap the map to place the pin instead.',
    unavailable: 'Could not get your location. Tap the map to place the pin instead.',
  };

  return (
    <div>
      <div
        ref={container}
        className="ng-map"
        style={{
          height: 'min(25vh, 280px)',
          border: '1px solid var(--edge)',
          borderRadius: 'var(--radius-md)',
          background: 'var(--bg-raised)',
        }}
        aria-hidden="true"
      />

      {/*
        * The keyboard and screen-reader path.
        *
        * A map is a pointer instrument. Rather than pretend a blank canvas can be operated
        * with a keyboard, the same answer is available as a list — which is also the way
        * out when geolocation is refused and a person cannot recognise an unlabelled dot.
        * Both controls write the same value.
        */}
      <div className="mt-3">
        <label
          htmlFor="ward"
          className="display block text-[length:var(--size-micro)] tracking-[0.14em]"
          style={{ color: 'var(--fg-muted)' }}
        >
          Or choose your ward
        </label>
        <select
          id="ward"
          className="ng-select mt-1"
          value={value ? zoneAt(city, value.lat, value.lng).id : ''}
          onChange={(event) => {
            const zone = city.zones.find((z) => z.id === event.target.value);
            if (zone) onChangeRef.current({ lat: zone.lat, lng: zone.lng, zone });
          }}
        >
          {city.zones.map((zone) => (
            <option key={zone.id} value={zone.id}>
              {zone.name}
            </option>
          ))}
        </select>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-3">
        <button
          type="button"
          className="ng-button display"
          style={{
            background: 'transparent',
            color: 'var(--fg)',
            border: '1px solid var(--edge)',
            minHeight: 'var(--tap-min)',
            fontSize: 'var(--size-small)',
          }}
          onClick={useMyLocation}
          disabled={geo === 'locating'}
        >
          {geo === 'locating' ? 'Finding you…' : 'Use my location'}
        </button>
      </div>

      {geoMessage[geo] && geo !== 'locating' && (
        <p className="mt-2 text-[length:var(--size-caption)]" style={{ color: 'var(--fg-muted)' }} role="status">
          {geoMessage[geo]}
        </p>
      )}

      {/* The map is honest about what it is not. */}
      <p className="mt-2 text-[length:var(--size-micro)]" style={{ color: 'var(--fg-muted)' }}>
        Ward positions only — no street tiles offline yet. The coordinates are real.
      </p>
    </div>
  );
}
