/**
 * Registration — under 60 seconds, every question skippable (CLAUDE.md §1).
 *
 * Seven questions, one per screen. Single-choice questions advance on selection, which is
 * what makes a minute realistic; the two that cannot (how many people, who needs help)
 * carry an explicit continue.
 *
 * Nothing here touches the network. The profile is written to IndexedDB and the app is
 * usable immediately — emergency functions require no account (CLAUDE.md §2), so the
 * device is the account and registration is a local act.
 *
 * The floor question gets special treatment because it carries the product's claim: the
 * screen shows, live, what tonight's forecast does at the floor being considered. A
 * ground floor and a third floor produce visibly different answers before the person has
 * finished registering.
 */
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import type { Band, BuildingType, City, Profile, ThresholdResponse, Zone } from '../lib/contract';
import { getCity, getForecast, postThreshold } from '../lib/api';
import { DEFAULT_CITY } from '../lib/mock';
import { saveProfile } from '../lib/storage';
import { LEVEL_WORD, formatValue } from '../lib/levels';
import { Button } from '../components/Button';
import { LevelChip } from '../components/LevelChip';
import { ThresholdLine } from '../components/ThresholdLine';
import { Choice, StepShell, Toggle } from '../components/setup/StepShell';
import { MapPicker, zoneAt } from '../components/setup/MapPicker';

/** The illustrative scenario the floor question previews. A hard but plausible hour. */
const PREVIEW_INTENSITY = 140;

const STEPS = ['place', 'building', 'floor', 'people', 'help', 'vehicle', 'language'] as const;
type StepId = (typeof STEPS)[number];

/**
 * What we take as true when a question is skipped.
 *
 * These lean toward over-warning, not under-warning: an unanswered floor is treated as
 * the ground floor and an unanswered vehicle as no vehicle, because being told to move
 * when you did not need to is a smaller harm than the reverse. Where an assumption would
 * invent a person — someone elderly, someone who needs help — it stays false.
 */
const DEFAULT_PROFILE: Profile = {
  buildingType: 'independent',
  floorLevel: 0,
  householdSize: 1,
  hasElderly: false,
  hasLimitedMobility: false,
  hasVehicle: false,
  language: 'en',
};

const BUILDINGS: Array<{ value: BuildingType; label: string; hint: string }> = [
  { value: 'independent', label: 'Independent house', hint: 'Your own building, on its own plot' },
  { value: 'apartment', label: 'Flat in an apartment block', hint: 'Shared building, more than one floor' },
  { value: 'row', label: 'Row house', hint: 'Shares walls with the houses beside it' },
  { value: 'hut', label: 'Temporary or thatched', hint: 'Sheet, thatch or timber walls' },
  { value: 'commercial', label: 'Shop or workplace', hint: 'Where you work rather than sleep' },
];

const FLOORS = [
  { value: 0, label: 'Ground floor' },
  { value: 1, label: 'First floor' },
  { value: 2, label: 'Second floor' },
  { value: 3, label: 'Third floor or higher' },
];

export default function Setup() {
  const navigate = useNavigate();
  const [step, setStep] = useState(0);
  const [profile, setProfile] = useState<Profile>(DEFAULT_PROFILE);
  const [skipped, setSkipped] = useState<string[]>([]);
  const [city, setCity] = useState<City | null>(null);
  const [place, setPlace] = useState<{ lat: number; lng: number; zone: Zone } | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let live = true;
    void getCity(DEFAULT_CITY).then((loaded) => {
      if (!live) return;
      setCity(loaded);
      // The pin is on the map from the first frame, so it has a value from the first
      // frame too. Showing a pin while the continue is disabled reads as broken.
      setPlace((existing) =>
        existing ?? {
          lat: loaded.center.lat,
          lng: loaded.center.lng,
          zone: zoneAt(loaded, loaded.center.lat, loaded.center.lng),
        },
      );
    });
    return () => {
      live = false;
    };
  }, []);

  const total = STEPS.length;
  const current: StepId = STEPS[step];

  function advance() {
    setStep((s) => Math.min(s + 1, total));
  }

  function skip() {
    setSkipped((list) => (list.includes(current) ? list : [...list, current]));
    advance();
  }

  /** Answering clears any earlier skip of the same question — Back then answer must stick. */
  function answer<K extends keyof Profile>(key: K, value: Profile[K]) {
    setProfile((p) => ({ ...p, [key]: value }));
    setSkipped((list) => list.filter((id) => id !== current));
  }

  async function finish(finalProfile: Profile, finalSkipped: string[]) {
    setSaving(true);
    const zone = place?.zone ?? city?.zones[0];
    await saveProfile({
      ...finalProfile,
      city: city?.id ?? DEFAULT_CITY,
      zoneId: zone?.id ?? 'kaloor',
      lat: place?.lat ?? city?.center.lat ?? 0,
      lng: place?.lng ?? city?.center.lng ?? 0,
      skipped: finalSkipped,
    });
    // Named for what happened, in the same words the button used.
    toast.success('Home saved on this device');
    navigate('/');
  }

  // The last question completes registration rather than landing on a dead "done" screen.
  function answerAndFinish<K extends keyof Profile>(key: K, value: Profile[K]) {
    const next = { ...profile, [key]: value };
    setProfile(next);
    void finish(next, skipped.filter((id) => id !== current));
  }

  if (step >= total || saving) {
    return (
      <section className="mx-auto w-full max-w-[34rem] px-5 py-10">
        <p className="text-[length:var(--size-body)]">Saving your home to this device…</p>
      </section>
    );
  }

  const shell = {
    index: step,
    total,
    onSkip: skip,
    onBack: step > 0 ? () => setStep((s) => s - 1) : undefined,
  };

  switch (current) {
    case 'place':
      return (
        <StepShell
          {...shell}
          question="Where is your home?"
          why="Warnings are worked out for this spot, not for the district around it. Your street can flood while the next one stays dry."
          assumption={`We'll use the centre of ${city?.name ?? 'the city'}.`}
          footer={
            <Button variant="primary" onClick={advance}>
              {place ? `Next — ${place.zone.name}` : 'Next'}
            </Button>
          }
        >
          {city ? (
            <MapPicker city={city} value={place} onChange={setPlace} />
          ) : (
            <p style={{ color: 'var(--fg-muted)' }}>Loading the map…</p>
          )}
        </StepShell>
      );

    case 'building':
      return (
        <StepShell
          {...shell}
          question="What kind of building is it?"
          why="The same water is a different problem in a concrete block and in a thatched house."
          assumption="We'll assume an independent house."
        >
          <div role="radiogroup" aria-label="Building type" className="space-y-2">
            {BUILDINGS.map((option) => (
              <Choice
                key={option.value}
                label={option.label}
                hint={option.hint}
                selected={profile.buildingType === option.value}
                onSelect={() => {
                  answer('buildingType', option.value);
                  advance();
                }}
              />
            ))}
          </div>
        </StepShell>
      );

    case 'floor':
      return (
        <FloorStep
          shell={shell}
          profile={profile}
          zoneId={place?.zone.id ?? city?.zones[0]?.id ?? 'kaloor'}
          cityId={city?.id ?? DEFAULT_CITY}
          onChoose={(floorLevel) => {
            answer('floorLevel', floorLevel);
            advance();
          }}
        />
      );

    case 'people':
      return (
        <StepShell
          {...shell}
          question="How many people live here?"
          why="Everyone who would have to leave with you, including children."
          assumption="We'll assume one person."
          footer={
            <Button variant="primary" onClick={advance}>
              Next
            </Button>
          }
        >
          <Counter
            value={profile.householdSize}
            min={1}
            max={20}
            label="People living here"
            onChange={(value) => answer('householdSize', value)}
          />
        </StepShell>
      );

    case 'help':
      return (
        <StepShell
          {...shell}
          question="Does anyone here need help to move?"
          why="If someone does, your warning comes earlier — enough time to get them out, not just to know."
          assumption="We'll assume nobody does."
          footer={
            <Button variant="primary" onClick={advance}>
              Next
            </Button>
          }
        >
          <div className="space-y-2">
            <Toggle
              label="Someone is elderly"
              pressed={profile.hasElderly}
              onToggle={() => answer('hasElderly', !profile.hasElderly)}
            />
            <Toggle
              label="Someone needs help to move"
              hint="Bedridden, or cannot walk without help"
              pressed={profile.hasLimitedMobility}
              onToggle={() => answer('hasLimitedMobility', !profile.hasLimitedMobility)}
            />
          </div>
        </StepShell>
      );

    case 'vehicle':
      return (
        <StepShell
          {...shell}
          question="Is there a vehicle you could leave in?"
          why="Without one you need more time, so the warning has to come sooner."
          assumption="We'll assume there isn't."
        >
          <div role="radiogroup" aria-label="Vehicle available" className="space-y-2">
            <Choice
              label="Yes"
              hint="A car, a two-wheeler, or someone who would come for you"
              selected={profile.hasVehicle}
              onSelect={() => {
                answer('hasVehicle', true);
                advance();
              }}
            />
            <Choice
              label="No"
              selected={!profile.hasVehicle && !skipped.includes('vehicle')}
              onSelect={() => {
                answer('hasVehicle', false);
                advance();
              }}
            />
          </div>
        </StepShell>
      );

    case 'language':
      return (
        <StepShell
          {...shell}
          question="Which language should warnings be in?"
          why="This is the language the instruction on your screen will use."
          assumption="We'll use English."
        >
          <div role="radiogroup" aria-label="Language" className="space-y-2">
            <Choice
              label="മലയാളം"
              hint="Malayalam"
              selected={profile.language === 'ml'}
              onSelect={() => answerAndFinish('language', 'ml')}
            />
            <Choice
              label="English"
              selected={profile.language === 'en'}
              onSelect={() => answerAndFinish('language', 'en')}
            />
          </div>
        </StepShell>
      );
  }
}

/* ------------------------------------------------------------------------------------ */

/**
 * The floor question, with the claim made visible.
 *
 * Every floor's answer is fetched once, through the seam, and switching between them is
 * then instant. Tapping down the list shows the warning change under your thumb: the same
 * street, the same rain, a different sentence. That is the product, and this is the first
 * moment a person meets it.
 */
function FloorStep({
  shell,
  profile,
  zoneId,
  cityId,
  onChoose,
}: {
  shell: { index: number; total: number; onSkip: () => void; onBack?: () => void };
  profile: Profile;
  zoneId: string;
  cityId: string;
  onChoose: (floor: number) => void;
}) {
  const [preview, setPreview] = useState<Record<number, ThresholdResponse> | null>(null);
  const [bands, setBands] = useState<Band[] | null>(null);
  const [hovered, setHovered] = useState<number>(profile.floorLevel);

  /*
   * Depend on the profile's primitives rather than the object.
   *
   * A ref guard was standing in for a stable dependency here, and it deadlocked under
   * StrictMode's double-invoke: the first run's cleanup cleared its `live` flag before the
   * response arrived, and the second run saw the guard and never fetched at all. The
   * preview sat on "working out…" forever. Primitives make the effect honest — it re-runs
   * exactly when its inputs change, and running twice in development is harmless.
   */
  const { buildingType, householdSize, hasElderly, hasLimitedMobility, hasVehicle, language } = profile;

  useEffect(() => {
    let live = true;
    const base: Profile = {
      buildingType,
      householdSize,
      hasElderly,
      hasLimitedMobility,
      hasVehicle,
      language,
      floorLevel: 0,
    };

    void (async () => {
      const forecast = await getForecast({ city: cityId, hazard: 'flood', intensity: PREVIEW_INTENSITY });
      const answers = await Promise.all(
        FLOORS.map((floor) =>
          postThreshold({
            city: cityId,
            zoneId,
            hazard: 'flood',
            intensity: PREVIEW_INTENSITY,
            profile: { ...base, floorLevel: floor.value },
          }),
        ),
      );
      if (!live) return;
      setBands(forecast.bands);
      setPreview(Object.fromEntries(FLOORS.map((floor, i) => [floor.value, answers[i]])));
    })();

    return () => {
      live = false;
    };
  }, [cityId, zoneId, buildingType, householdSize, hasElderly, hasLimitedMobility, hasVehicle, language]);

  const shown = preview?.[hovered];

  return (
    <StepShell
      {...shell}
      question="Which floor do you live on?"
      why="This changes your warning more than anything else you tell us."
      assumption="We'll assume the ground floor, which warns you earlier rather than later."
    >
      <div role="radiogroup" aria-label="Floor" className="space-y-2">
        {FLOORS.map((floor) => (
          <Choice
            key={floor.value}
            label={floor.label}
            selected={hovered === floor.value}
            onSelect={() => {
              setHovered(floor.value);
              onChoose(floor.value);
            }}
          />
        ))}
      </div>

      {/* The demonstration. Not a diagram of the product — the product, answering. */}
      <div
        className="mt-6 p-4"
        style={{ border: '1px solid var(--hairline)', borderRadius: 'var(--radius-md)' }}
        aria-live="polite"
      >
        <div
          className="display text-[length:var(--size-micro)] tracking-[0.14em]"
          style={{ color: 'var(--fg-muted)' }}
        >
          On a night of heavy rain, at this floor
        </div>

        {shown && bands ? (
          <>
            <div className="mt-3 flex items-center gap-3">
              <LevelChip level={shown.level} />
              <span className="text-[length:var(--size-small)]" style={{ color: 'var(--fg-muted)' }}>
                {shown.exposure > 0
                  ? `Water reaches ${formatValue(shown.exposure, shown.unit)} where you live`
                  : 'The water does not reach you'}
              </span>
            </div>
            <div className="mt-4">
              <ThresholdLine
                current={shown.exposure}
                threshold={shown.threshold}
                unit={shown.unit}
                bands={bands}
                size="md"
                label={`Flood at floor ${hovered}: ${formatValue(shown.exposure, shown.unit)} against a ${formatValue(shown.threshold, shown.unit)} limit`}
              />
            </div>
            <p className="mt-4 text-[length:var(--size-small)]" style={{ fontWeight: 500 }}>
              {shown.action}
            </p>
          </>
        ) : (
          <p className="mt-3 text-[length:var(--size-small)]" style={{ color: 'var(--fg-muted)' }}>
            Working out what this floor would be told…
          </p>
        )}

        <p className="mt-3 text-[length:var(--size-micro)]" style={{ color: 'var(--fg-muted)' }}>
          Modelled for {LEVEL_WORD.warning.toLowerCase()}-level rainfall. Simulated data.
        </p>
      </div>
    </StepShell>
  );
}

/** A number you can set with a thumb or with the keyboard. */
function Counter({
  value,
  min,
  max,
  label,
  onChange,
}: {
  value: number;
  min: number;
  max: number;
  label: string;
  onChange: (value: number) => void;
}) {
  const step = (delta: number) => onChange(Math.min(max, Math.max(min, value + delta)));

  return (
    <div className="flex items-center gap-4">
      <button
        type="button"
        className="ng-button display"
        style={{
          background: 'transparent',
          color: 'var(--fg)',
          border: '1px solid var(--edge)',
          minHeight: 'var(--tap-sos)',
          minWidth: 'var(--tap-sos)',
          fontSize: 'var(--size-title)',
        }}
        onClick={() => step(-1)}
        disabled={value <= min}
        aria-label={`One fewer person. Currently ${value}.`}
      >
        −
      </button>

      <output
        className="num flex-1 text-center text-[length:var(--size-num-xl)]"
        style={{ fontWeight: 500 }}
        aria-label={`${label}: ${value}`}
      >
        {value}
      </output>

      <button
        type="button"
        className="ng-button display"
        style={{
          background: 'transparent',
          color: 'var(--fg)',
          border: '1px solid var(--edge)',
          minHeight: 'var(--tap-sos)',
          minWidth: 'var(--tap-sos)',
          fontSize: 'var(--size-title)',
        }}
        onClick={() => step(1)}
        disabled={value >= max}
        aria-label={`One more person. Currently ${value}.`}
      >
        +
      </button>
    </div>
  );
}
