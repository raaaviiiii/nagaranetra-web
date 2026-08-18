/**
 * Emergency services near this household.
 *
 * Not a list of institutions in a city — a list measured from one doorstep, which is the
 * whole point of the platform. Distances come from `/nearby` through the seam, so this
 * screen works with the backend switched off like everything else.
 *
 * The numbers are India's public emergency numbers and each row says which one it dials.
 * Nothing here implies we dispatch anybody; we do not (CLAUDE.md §2).
 */
import { useEffect, useState } from 'react';
import type { NearbyService, ServiceType } from '../lib/contract';
import { getNearby } from '../lib/api';
import { loadProfile } from '../lib/storage';
import { Button } from '../components/Button';
import { Page, PageHeader } from '../components/Page';
import { Panel } from '../components/Panel';
import { Stat } from '../components/Stat';

/** Where to look from when nobody has registered yet: the city centre, and we say so. */
const FALLBACK = { lat: 9.9816, lng: 76.2999 };

const TYPE_LABEL: Record<ServiceType, string> = {
  hospital: 'Hospital',
  fire: 'Fire station',
  police: 'Police station',
  shelter: 'Shelter',
};

/** What each service is for, in the words someone would use to decide. */
const TYPE_PURPOSE: Record<ServiceType, string> = {
  hospital: 'Injury, illness, medicine',
  fire: 'Fire, rescue, trapped',
  police: 'Danger, missing person',
  shelter: 'Somewhere to stay tonight',
};

function formatDistance(metres: number): string {
  return metres < 1000 ? `${metres} m` : `${(metres / 1000).toFixed(1)} km`;
}

/** Roughly how long it takes to walk it, which is the number that matters on foot. */
function walkMinutes(metres: number): number {
  return Math.max(1, Math.round(metres / 80));
}

export default function Nearby() {
  const [services, setServices] = useState<NearbyService[] | null>(null);
  const [registered, setRegistered] = useState(true);

  useEffect(() => {
    let live = true;
    void (async () => {
      const profile = await loadProfile();
      if (!live) return;
      setRegistered(Boolean(profile));
      const from = profile ? { lat: profile.lat, lng: profile.lng } : FALLBACK;
      const result = await getNearby(from);
      if (live) setServices(result.services);
    })();
    return () => {
      live = false;
    };
  }, []);

  const nearest = services?.[0];

  return (
    <Page>
      <PageHeader
        label="Normal days"
        title="Emergency services near you"
        lead={
          registered
            ? 'Measured from the address you registered, not from the middle of the district.'
            : 'Measured from the centre of the city — register your household and these become distances from your door.'
        }
        aside={
          services && (
            <>
              <Stat label="Services" value={String(services.length)} />
              {nearest && <Stat label="Nearest" value={formatDistance(nearest.distanceM)} />}
            </>
          )
        }
      />

      {!services ? (
        <Panel>
          <p style={{ color: 'var(--fg-muted)' }}>Finding what is near you…</p>
        </Panel>
      ) : (
        <div className="grid gap-5 lg:grid-cols-2">
          {services.map((service) => (
            <Panel key={`${service.type}-${service.name}`} heading={TYPE_LABEL[service.type]}>
              <div className="flex items-start justify-between" style={{ gap: 'var(--space-md)' }}>
                <div className="min-w-0">
                  <h2
                    style={{
                      fontSize: 'var(--size-lead)',
                      fontWeight: 600,
                      lineHeight: 1.25,
                      textWrap: 'balance',
                    }}
                  >
                    {service.name}
                  </h2>
                  <p
                    style={{
                      marginTop: 'var(--space-xs)',
                      fontSize: 'var(--size-caption)',
                      color: 'var(--fg-muted)',
                    }}
                  >
                    {TYPE_PURPOSE[service.type]}
                  </p>
                </div>

                <div style={{ textAlign: 'right', flex: '0 0 auto' }}>
                  <div className="num" style={{ fontSize: 'var(--size-num-lead)', fontWeight: 500, lineHeight: 1 }}>
                    {formatDistance(service.distanceM)}
                  </div>
                  <div
                    className="num"
                    style={{ marginTop: 2, fontSize: 'var(--size-caption)', color: 'var(--fg-muted)' }}
                  >
                    {walkMinutes(service.distanceM)} min walk
                  </div>
                </div>
              </div>

              <div
                className="flex flex-wrap"
                style={{ gap: 'var(--space-sm)', marginTop: 'var(--space-lg)' }}
              >
                <Button
                  variant="primary"
                  href={`tel:${service.phone}`}
                  aria-label={`Call ${service.name} on ${service.phone}`}
                >
                  Call {service.phone}
                </Button>
                <Button
                  variant="quiet"
                  href={`geo:${service.lat},${service.lng}?q=${encodeURIComponent(service.name)}`}
                  aria-label={`Open directions to ${service.name}`}
                >
                  Directions
                </Button>
              </div>
            </Panel>
          ))}
        </div>
      )}

      <p
        style={{
          marginTop: 'var(--space-2xl)',
          fontSize: 'var(--size-micro)',
          color: 'var(--fg-muted)',
          lineHeight: 1.6,
        }}
      >
        Facility names and positions are simulated pending the city's own register. The
        phone numbers are India's public emergency numbers and are correct for anyone.
      </p>
    </Page>
  );
}
