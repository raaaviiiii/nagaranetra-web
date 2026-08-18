/**
 * Shelters near this household, with how full each one is.
 *
 * The decision this screen supports is "where do I take my family, now" — so the ordering
 * is by distance, capacity is shown as a bar before it is shown as a number, and a shelter
 * with no space left says so before anything else about it.
 *
 * Data comes through the seam, so it works with the backend switched off.
 */
import { useEffect, useState } from 'react';
import type { Shelter } from '../lib/contract';
import { getShelters } from '../lib/api';
import { loadProfile } from '../lib/storage';
import { DEFAULT_CITY } from '../lib/mock';
import { Button } from '../components/Button';
import { CapacityBar } from '../components/CapacityBar';
import { Page, PageHeader } from '../components/Page';
import { Panel } from '../components/Panel';
import { Stat } from '../components/Stat';

const FALLBACK = { city: DEFAULT_CITY, lat: 9.9816, lng: 76.2999 };

function formatDistance(metres: number): string {
  return metres < 1000 ? `${metres} m` : `${(metres / 1000).toFixed(1)} km`;
}

function walkMinutes(metres: number): number {
  return Math.max(1, Math.round(metres / 80));
}

export default function Shelters() {
  const [shelters, setShelters] = useState<Shelter[] | null>(null);

  useEffect(() => {
    let live = true;
    void (async () => {
      const profile = await loadProfile();
      if (!live) return;
      const from = profile
        ? { city: profile.city, lat: profile.lat, lng: profile.lng }
        : FALLBACK;
      const result = await getShelters(from);
      if (live) setShelters(result.shelters);
    })();
    return () => {
      live = false;
    };
  }, []);

  /* The header must count what the list shows. It was counting every shelter returned
     while the page rendered four, so the two numbers disagreed on screen. */
  const shown = shelters?.slice(0, 4) ?? null;
  const withSpace = shown?.filter((s) => s.open && s.occupancy < s.capacity) ?? [];
  const totalSpaces = withSpace.reduce((sum, s) => sum + (s.capacity - s.occupancy), 0);

  return (
    <Page>
      <PageHeader
        label="During"
        title="Shelters near you"
        lead="Ordered by how far you would have to travel. Capacity is reported by the shelter and can change while you are on your way."
        aside={
          shown && (
            <>
              <Stat label="With space" value={`${withSpace.length} of ${shown.length}`} />
              <Stat label="Places free" value={String(totalSpaces)} />
            </>
          )
        }
      />

      {!shown ? (
        <Panel>
          <p style={{ color: 'var(--fg-muted)' }}>Finding shelters near you…</p>
        </Panel>
      ) : (
        <div className="grid gap-5 lg:grid-cols-2">
          {shown.map((shelter) => {
            const full = shelter.occupancy >= shelter.capacity || !shelter.open;
            return (
              <Panel
                key={shelter.id}
                heading={full ? 'No space' : 'Open'}
                aside={
                  <span className="num" style={{ fontSize: 'var(--size-caption)', color: 'var(--fg-muted)' }}>
                    {formatDistance(shelter.distanceM)} · {walkMinutes(shelter.distanceM)} min walk
                  </span>
                }
              >
                <h2
                  style={{
                    fontSize: 'var(--size-lead)',
                    fontWeight: 600,
                    lineHeight: 1.25,
                    textWrap: 'balance',
                  }}
                >
                  {shelter.name}
                </h2>

                <div style={{ marginTop: 'var(--space-lg)' }}>
                  <CapacityBar
                    occupancy={shelter.occupancy}
                    capacity={shelter.capacity}
                    label={`Capacity at ${shelter.name}`}
                  />
                </div>

                <div
                  className="flex flex-wrap"
                  style={{ gap: 'var(--space-sm)', marginTop: 'var(--space-lg)' }}
                >
                  <Button
                    variant={full ? 'quiet' : 'primary'}
                    href={`geo:${shelter.lat},${shelter.lng}?q=${encodeURIComponent(shelter.name)}`}
                    aria-label={`Open directions to ${shelter.name}`}
                  >
                    Directions
                  </Button>
                  <Button variant="quiet" href="/help">
                    Ask for help getting there
                  </Button>
                </div>
              </Panel>
            );
          })}
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
        Occupancy figures are simulated pending the district's live shelter register. We
        notify and match — a human authority decides and acts.
      </p>
    </Page>
  );
}
