/**
 * The household dashboard.
 *
 * What this screen has to make obvious, at a glance, before anything is read carefully:
 * what to do. Everything else on it — the level, the instrument, the forecast, the phone
 * numbers — is evidence for that one sentence, and is sized accordingly.
 *
 * Two households on the same street get different screens here. A ground floor is told to
 * move and warned that it needs longer than it has; a third floor is told the water is not
 * coming to it. Same zone, same rainfall, different answer. If that is not obvious side by
 * side, this screen has failed.
 *
 * Everything is read through lib/api, so the whole screen works with the backend switched
 * off and says so in the header chip.
 */
import { Suspense, lazy, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import type { Forecast, NearbyService, ThresholdResponse } from '../lib/contract';
import { getForecast, getNearby, postThreshold } from '../lib/api';
import { loadProfile, type StoredProfile } from '../lib/storage';
import { Button } from '../components/Button';
import { EmptyState } from '../components/EmptyState';
import { ErrorState } from '../components/ErrorState';
import { NearbyList } from '../components/NearbyList';
import { StatusCard } from '../components/StatusCard';
import { HouseSection } from '../components/HouseSection';
import { Page, PageHeader } from '../components/Page';
import { Panel } from '../components/Panel';
import { Stat } from '../components/Stat';

// Recharts is a third of the bundle and the chart is evidence, not the instruction.
// The status card paints first; the chart arrives a beat later.
const ForecastSparkline = lazy(() =>
  import('../components/ForecastSparkline').then((m) => ({ default: m.ForecastSparkline })),
);

/**
 * The driving conditions the dashboard reads against.
 *
 * Until the live nowcast is wired, this is the committed scenario the demo runs on. It is
 * one number in one place, and the chip in the header already tells the resident the data
 * is simulated.
 */
const SCENARIO_INTENSITY = 120;

type Loaded = {
  profile: StoredProfile;
  forecast: Forecast;
  answer: ThresholdResponse;
  services: NearbyService[];
};

/** What each skipped question means for the answer on screen, in the resident's terms. */
const ASSUMPTION_COPY: Record<string, string> = {
  place: 'the centre of the city, not your street',
  building: 'an independent house',
  floor: 'the ground floor',
  people: 'one person',
  help: 'nobody needs help to move',
  vehicle: 'no vehicle',
  language: 'English',
};

export default function Dashboard() {
  const [state, setState] = useState<
    { kind: 'loading' } | { kind: 'none' } | { kind: 'error'; message: string } | ({ kind: 'ready' } & Loaded)
  >({ kind: 'loading' });

  useEffect(() => {
    let live = true;

    void (async () => {
      try {
        const profile = await loadProfile();
        if (!live) return;
        if (!profile) {
          setState({ kind: 'none' });
          return;
        }

        const [forecast, answer, nearby] = await Promise.all([
          getForecast({ city: profile.city, hazard: 'flood', intensity: SCENARIO_INTENSITY }),
          postThreshold({
            city: profile.city,
            zoneId: profile.zoneId,
            hazard: 'flood',
            intensity: SCENARIO_INTENSITY,
            profile,
          }),
          getNearby({ lat: profile.lat, lng: profile.lng }),
        ]);
        if (!live) return;
        setState({ kind: 'ready', profile, forecast, answer, services: nearby.services });
      } catch (error) {
        // In mock and auto modes the seam never throws; this is the live-mode path.
        if (live) setState({ kind: 'error', message: String(error) });
      }
    })();

    return () => {
      live = false;
    };
  }, []);

  if (state.kind === 'loading') {
    return (
      <Page>
        <p style={{ fontSize: 'var(--size-body)', color: 'var(--fg-muted)' }}>
          Working out what this means for your house…
        </p>
      </Page>
    );
  }

  if (state.kind === 'none') {
    return (
      <Page>
        <PageHeader
          label="Your household"
          title="Warnings about your house, not your district"
          lead="Everyone in a district gets the same sentence today, whether they live on a ground floor or a third floor. Tell us about your home once and every warning after this one is worked out for it."
        />
        <div className="grid items-start gap-5 lg:grid-cols-2">
          <Panel>
            <EmptyState
              heading="Tell us about your home"
              body="Your floor and your building change the answer more than anything else. Under a minute, and you can skip any question."
              actionLabel="Register your household"
              href="/setup"
            />
          </Panel>
          <Panel heading="Why the floor matters">
            <HouseSection level="alert" />
            <p
              style={{
                marginTop: 'var(--space-md)',
                fontSize: 'var(--size-caption)',
                color: 'var(--fg-muted)',
                lineHeight: 1.55,
              }}
            >
              The same 60 cm of water on the same street. The ground floor is in trouble and
              the floors above it are not — so they should not be told the same thing.
            </p>
          </Panel>
        </div>
      </Page>
    );
  }

  if (state.kind === 'error') {
    return (
      <Page>
        <ErrorState
          heading="Cannot work out your warning"
          whatHappened="The forecast service answered with something this app could not read, so there is no number to show you rather than a wrong one."
          howToFix="Emergency requests do not need this screen — you can still ask for help."
          actionLabel="Get help"
          onAction={() => {
            window.location.href = '/help';
          }}
        />
      </Page>
    );
  }

  const { profile, forecast, answer, services } = state;
  const zoneName = forecast.frames[0]?.zones.find((zone) => zone.id === profile.zoneId)?.id ?? profile.zoneId;
  const assumptions = profile.skipped.map((id) => ASSUMPTION_COPY[id]).filter(Boolean);

  return (
    <Page>
      <PageHeader
        label={`Your household · ${titleCase(zoneName)}`}
        title="What this means for your house"
        aside={
          <>
            <Stat label="Level" value={answer.level === 'none' ? 'No warning' : titleCase(answer.level)} />
            <Stat
              label={answer.crossesAtMin === null ? 'Your limit' : 'Crosses in'}
              value={answer.crossesAtMin === null ? 'Not reached' : `${answer.crossesAtMin} min`}
            />
          </>
        }
      />

      <div className="grid items-start gap-5 lg:grid-cols-[1.15fr_0.85fr]">
        <div className="grid gap-5">
      <StatusCard
        hazardLabel={`Flood · ${titleCase(zoneName)}`}
        level={answer.level}
        current={answer.exposure}
        threshold={answer.threshold}
        unit={answer.unit}
        bands={forecast.bands}
        action={answer.action}
        actionMl={profile.language === 'ml' ? answer.action_ml : undefined}
        crossesAtMin={answer.crossesAtMin}
        leadTimeMin={answer.leadTimeMin}
        reasons={answer.reasons}
      />

      {/* Directly under the instruction, because it is what the instruction leads to. */}
      <div>
        <Button variant="emergency" size="lg" href="/help" style={{ width: '100%' }}>
          Get help
        </Button>
        <p
          style={{
            marginTop: 'var(--space-sm)',
            fontSize: 'var(--size-caption)',
            color: 'var(--fg-muted)',
            lineHeight: 1.5,
          }}
        >
          No account needed. Works without a network — your request is queued and sent when
          the signal returns.
        </p>
      </div>

      {/* An answer built partly on assumptions has to say which ones. */}
      {assumptions.length > 0 && (
        <p
          style={{
            fontSize: 'var(--size-caption)',
            color: 'var(--fg-muted)',
            lineHeight: 1.5,
          }}
        >
          You skipped some questions, so this assumes {assumptions.join(', ')}.{' '}
          <Link to="/setup" style={{ color: 'var(--action)' }}>
            Fill them in
          </Link>{' '}
          and it gets sharper.
        </p>
      )}

        </div>

        <div className="grid gap-5" style={{ alignContent: 'start' }}>
          <Panel>
        <Suspense fallback={<div style={{ height: 200 }} aria-hidden="true" />}>
          <ForecastSparkline
            forecast={forecast}
            zoneId={profile.zoneId}
            crossesAtMin={answer.crossesAtMin}
            level={answer.level}
            unit={answer.unit}
          />
        </Suspense>
          </Panel>

          <Panel heading="Nearest help" padded={false}>
            <div style={{ padding: '0 var(--space-lg) var(--space-md)' }}>
              <NearbyList services={services} heading={null} />
            </div>
          </Panel>
        </div>
      </div>

      <p
        style={{
          marginTop: 'var(--space-2xl)',
          fontSize: 'var(--size-micro)',
          color: 'var(--fg-muted)',
          lineHeight: 1.6,
        }}
      >
        Hazard levels are modelled, not measured. We notify and match — a human authority
        decides and acts.
      </p>
    </Page>
  );
}

/** Zone ids are lowercase slugs; a resident should see a name. */
function titleCase(value: string): string {
  return value.replace(/(^|[\s-])(\w)/g, (_, lead: string, letter: string) => lead + letter.toUpperCase());
}
