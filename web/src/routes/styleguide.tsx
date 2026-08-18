/**
 * THE DESIGN SYSTEM, RENDERED (CLAUDE.md §4).
 *
 * This page is a specimen sheet, not a component gallery. It is laid out the way a public
 * standards document is laid out — clause numbers, a masthead, a rule under every heading,
 * a stated rule before every specimen — because that is the vernacular the product is
 * borrowing from, and a design system for public safety infrastructure should read like
 * one.
 *
 * It is also the system's own test rig. §2 computes every contrast ratio live in the
 * browser from the actual CSS variables, so a token that drifts out of WCAG AA fails here,
 * visibly, before it reaches a screen. §3 drives the signature element from real mock data
 * for two different hazards in two different units.
 */
import { useMemo, useRef, useState } from 'react';
import type { Band, HazardUnit, Level, Profile } from '../lib/contract';
import * as mock from '../lib/mock';
import { readToken, verdict } from '../lib/contrast';
import { LEVEL_MEANING, LEVEL_ORDER, LEVEL_WORD, formatValue } from '../lib/levels';
import { Button } from '../components/Button';
import { EmptyState } from '../components/EmptyState';
import { ErrorState } from '../components/ErrorState';
import { LevelChip } from '../components/LevelChip';
import { StatusCard } from '../components/StatusCard';
import { StatusChipView } from '../components/StatusChip';
import { Surface } from '../components/Surface';
import { ThresholdLine } from '../components/ThresholdLine';

/* ------------------------------------------------------------------------------------ */
/* Sheet furniture                                                                        */
/* ------------------------------------------------------------------------------------ */

/**
 * A numbered clause. The numbering is not decoration: this document is referred to by
 * clause elsewhere in the repo ("see §2 of /styleguide"), the way CLAUDE.md is.
 */
function Clause({
  n,
  title,
  rule,
  children,
}: {
  n: string;
  title: string;
  rule: string;
  children: React.ReactNode;
}) {
  return (
    <section className="mt-14 first:mt-0" id={`clause-${n}`}>
      <div className="flex items-baseline gap-3">
        <span
          className="num text-[length:var(--size-caption)]"
          style={{ color: 'var(--fg-muted)' }}
          aria-hidden="true"
        >
          §{n}
        </span>
        <h2
          className="display text-[length:var(--size-title)] tracking-[0.06em]"
          style={{ fontWeight: 800 }}
        >
          {title}
        </h2>
      </div>
      <hr className="sheet-rule mt-2" />
      <p
        className="mt-3 max-w-[62ch] text-[length:var(--size-small)] leading-relaxed"
        style={{ color: 'var(--fg-muted)' }}
      >
        {rule}
      </p>
      <div className="mt-6">{children}</div>
    </section>
  );
}

/** A labelled specimen block. The label is stamped above the field, as on a form. */
function Specimen({
  label,
  children,
  className = '',
}: {
  label: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={className}>
      <div
        className="display mb-2 text-[length:var(--size-micro)] tracking-[0.14em]"
        style={{ color: 'var(--fg-muted)' }}
      >
        {label}
      </div>
      <div
        className="p-4"
        style={{ border: '1px solid var(--hairline)', borderRadius: 'var(--radius-sm)' }}
      >
        {children}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------------------------ */
/* §1 Typography                                                                          */
/* ------------------------------------------------------------------------------------ */

/** Every size the product uses, with the job it does and a specimen in both scripts. */
const TYPE_SCALE: Array<{
  token: string;
  job: string;
  face: 'display' | 'body' | 'mal' | 'num';
  weight: number;
  en: string;
  ml: string;
}> = [
  {
    token: '--size-display',
    job: 'Page title',
    face: 'display',
    weight: 800,
    en: 'YOUR HOUSEHOLD',
    ml: 'നിങ്ങളുടെ വീട്',
  },
  {
    token: '--size-status',
    job: 'Status word',
    face: 'display',
    weight: 800,
    en: 'WARNING',
    ml: 'മുന്നറിയിപ്പ്',
  },
  {
    token: '--size-action',
    job: 'The action — largest element on a citizen screen',
    face: 'body',
    weight: 600,
    en: 'Move to a higher floor now.',
    ml: 'ഇപ്പോൾ മുകളിലത്തെ നിലയിലേക്ക് മാറുക.',
  },
  {
    token: '--size-title',
    job: 'Section heading',
    face: 'display',
    weight: 700,
    en: 'Shelters near you',
    ml: 'അടുത്തുള്ള ഷെൽട്ടറുകൾ',
  },
  {
    token: '--size-body',
    job: 'Body copy',
    face: 'body',
    weight: 400,
    en: 'Water is expected to reach your door before 14:20.',
    ml: 'വെള്ളം നിങ്ങളുടെ വാതിൽക്കൽ എത്താൻ സാധ്യതയുണ്ട്.',
  },
  {
    token: '--size-small',
    job: 'Secondary body',
    face: 'body',
    weight: 400,
    en: 'You need 90 minutes to move.',
    ml: 'മാറാൻ 90 മിനിറ്റ് വേണം.',
  },
  {
    token: '--size-caption',
    job: 'Caption, list label',
    face: 'body',
    weight: 400,
    en: 'Ground floor · No vehicle',
    ml: 'താഴത്തെ നില · വാഹനമില്ല',
  },
  {
    token: '--size-micro',
    job: 'Stamped label, chip, clause number',
    face: 'display',
    weight: 700,
    en: 'SIMULATED DATA',
    ml: 'പരീക്ഷണ വിവരം',
  },
];

const FACE_CLASS: Record<'display' | 'body' | 'mal' | 'num', string> = {
  display: 'display',
  body: '',
  mal: 'font-mal',
  num: 'num',
};

/**
 * Malayalam is an alphasyllabary: consonants stack into conjuncts and vowel signs attach
 * around the base glyph. If the font is not shaping, these render as separate letters with
 * visible virama marks, or as dotted-circle placeholders. That is a bug, not a quirk, so
 * the specimens are here to be looked at.
 */
const SHAPING_TESTS: Array<{ label: string; sample: string }> = [
  { label: 'Conjuncts (kka, nga, tta, nta)', sample: 'ക്ക ങ്ങ ട്ട ണ്ട' },
  { label: 'Conjuncts (nna, ntha, mpa, lla)', sample: 'ന്ന ന്ത മ്പ ല്ല' },
  { label: 'Conjuncts (lla, rra, ksha, jnja)', sample: 'ള്ള റ്റ ക്ഷ ജ്ഞ' },
  { label: 'Vowel signs on ka', sample: 'ക കി കീ കു കൂ കൃ കെ കേ കൈ കൊ കോ കൗ' },
  { label: 'Chillu (pure consonants)', sample: 'ൻ ർ ൽ ൾ ൺ' },
  { label: 'In running text', sample: 'നിങ്ങളുടെ വീട്ടിൽ വെള്ളം കയറാൻ സാധ്യതയുണ്ട്.' },
];

function TypographyClause() {
  return (
    <>
      <div className="space-y-6">
        {TYPE_SCALE.map((step) => (
          <div key={step.token}>
            <div
              className="mb-1.5 flex flex-wrap items-baseline gap-x-3 gap-y-0.5"
              style={{ borderBottom: '1px solid var(--hairline)', paddingBottom: '0.35rem' }}
            >
              <span className="num text-[length:var(--size-micro)]" style={{ color: 'var(--fg-muted)' }}>
                {step.token}
              </span>
              <span
                className="text-[length:var(--size-micro)]"
                style={{ color: 'var(--fg-muted)' }}
              >
                {step.job}
              </span>
            </div>
            {/* Latin and Malayalam at the same size, side by side, so a shaping or
                vertical-metric problem in the Malayalam is impossible to miss. */}
            <div className="grid gap-x-6 gap-y-2 sm:grid-cols-2">
              <p
                className={FACE_CLASS[step.face]}
                style={{ fontSize: `var(${step.token})`, fontWeight: step.weight, lineHeight: 1.15 }}
              >
                {step.en}
              </p>
              <p
                className="font-mal"
                lang="ml"
                style={{ fontSize: `var(${step.token})`, fontWeight: step.weight, lineHeight: 1.35 }}
              >
                {step.ml}
              </p>
            </div>
          </div>
        ))}
      </div>

      <Specimen label="Malayalam shaping — conjuncts and vowel signs" className="mt-8">
        <dl className="grid gap-3 sm:grid-cols-2">
          {SHAPING_TESTS.map((test) => (
            <div key={test.label}>
              <dt
                className="text-[length:var(--size-micro)]"
                style={{ color: 'var(--fg-muted)' }}
              >
                {test.label}
              </dt>
              <dd className="font-mal mt-0.5 text-[1.6rem] leading-[1.5]" lang="ml">
                {test.sample}
              </dd>
            </div>
          ))}
        </dl>
      </Specimen>

      <Specimen label="Numbers — IBM Plex Mono, tabular" className="mt-6">
        <p
          className="text-[length:var(--size-caption)]"
          style={{ color: 'var(--fg-muted)', marginBottom: '0.6rem' }}
        >
          Every number that can change is tabular, so a digit changing does not shift the
          ones beside it. Compare the columns: they hold their position.
        </p>
        <div className="num grid grid-cols-3 gap-x-6 text-[length:var(--size-num-lg)]">
          {['14.0 cm', '111.1 cm', '38.4 cm', '09:15', '11:00', '14:20', '0.65', '0.20', '0.41'].map(
            (value) => (
              <span key={value} style={{ fontWeight: 500 }}>
                {value}
              </span>
            ),
          )}
        </div>
      </Specimen>
    </>
  );
}

/* ------------------------------------------------------------------------------------ */
/* §2 Colour and contrast                                                                 */
/* ------------------------------------------------------------------------------------ */

type Pair = {
  fg: string;
  bg: string;
  use: string;
  need: 4.5 | 3;
  /**
   * WCAG 1.4.11 exempts a graphic when "a particular presentation is essential to the
   * information being conveyed". The IMD ladder is that case: reproducing the published
   * warning colours IS the information. Set this to the reason, and the row reports the
   * measured ratio without scoring it as a defect. Only legitimate where the meaning does
   * not depend on the colour — see the note under the tables.
   */
  essential?: string;
};

const CITIZEN_PAIRS: Pair[] = [
  { fg: '--ink', bg: '--paper', use: 'Body text on paper', need: 4.5 },
  { fg: '--ink-muted', bg: '--paper', use: 'Secondary text on paper', need: 4.5 },
  { fg: '--ink', bg: '--paper-raised', use: 'Body text on a raised panel', need: 4.5 },
  { fg: '--act', bg: '--paper', use: 'Action text / link', need: 4.5 },
  { fg: '--paper-raised', bg: '--act', use: 'Text on the action button', need: 4.5 },
  { fg: '--on-none', bg: '--lvl-none', use: 'Text on the "no warning" chip', need: 4.5 },
  { fg: '--on-watch', bg: '--lvl-watch', use: 'Text on the watch chip', need: 4.5 },
  { fg: '--on-alert', bg: '--lvl-alert', use: 'Text on the alert chip', need: 4.5 },
  { fg: '--on-warning', bg: '--lvl-warning', use: 'Text on the warning chip', need: 4.5 },
  { fg: '--lvl-warning', bg: '--paper', use: 'Warning text on paper', need: 4.5 },
  { fg: '--edge', bg: '--paper', use: 'Control border (non-text)', need: 3 },
  { fg: '--lvl-none', bg: '--paper', use: 'Ladder fill on paper', need: 3, essential: 'IMD ladder' },
  { fg: '--lvl-watch', bg: '--paper', use: 'Ladder fill on paper', need: 3, essential: 'IMD ladder' },
  { fg: '--lvl-alert', bg: '--paper', use: 'Ladder fill on paper', need: 3, essential: 'IMD ladder' },
  { fg: '--lvl-warning', bg: '--paper', use: 'Ladder fill on paper', need: 3, essential: 'IMD ladder' },
];

const CITY_PAIRS: Pair[] = [
  { fg: '--ink-dark', bg: '--base', use: 'Body text on the city surface', need: 4.5 },
  { fg: '--ink-dark', bg: '--surface', use: 'Body text on a city panel', need: 4.5 },
  { fg: '--action', bg: '--base', use: 'Action text on city', need: 4.5 },
  { fg: '--lvl-none', bg: '--base', use: '"No warning" as text on city', need: 4.5 },
  { fg: '--lvl-watch', bg: '--base', use: 'Watch as text on city', need: 4.5 },
  { fg: '--lvl-alert', bg: '--base', use: 'Alert as text on city', need: 4.5 },
  { fg: '--lvl-warning', bg: '--base', use: 'Warning as text on city', need: 4.5 },
  { fg: '--on-none', bg: '--lvl-none', use: 'Text on the "no warning" chip', need: 4.5 },
  { fg: '--on-warning', bg: '--lvl-warning', use: 'Text on the warning chip', need: 4.5 },
  { fg: '--edge', bg: '--base', use: 'Control border (non-text)', need: 3 },
];

/**
 * Ratios are read out of the live DOM, not typed in. `element` scopes the read, so the
 * city rows resolve the same token names to the city surface's values.
 */
function ContrastTable({ pairs, element }: { pairs: Pair[]; element: Element | null }) {
  const rows = useMemo(() => {
    if (!element) return [];
    return pairs.map((pair) => {
      const result = verdict(readToken(pair.fg, element), readToken(pair.bg, element));
      return { ...pair, result };
    });
  }, [pairs, element]);

  if (rows.length === 0) return null;

  return (
    <table className="w-full text-left" style={{ borderCollapse: 'collapse' }}>
      <thead>
        <tr
          className="display text-[length:var(--size-micro)] tracking-[0.1em]"
          style={{ color: 'var(--fg-muted)' }}
        >
          <th className="py-1.5 pr-3 font-normal">Use</th>
          <th className="py-1.5 pr-3 font-normal">Pair</th>
          <th className="py-1.5 pr-3 text-right font-normal">Ratio</th>
          <th className="py-1.5 text-right font-normal">AA</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((row) => {
          const measured = row.need === 4.5 ? row.result?.aa : row.result?.ui;
          const passes = measured || Boolean(row.essential);
          return (
            <tr key={`${row.fg}-${row.bg}-${row.use}`} style={{ borderTop: '1px solid var(--hairline)' }}>
              <td className="py-1.5 pr-3 text-[length:var(--size-caption)]">{row.use}</td>
              <td
                className="num py-1.5 pr-3 text-[length:var(--size-micro)]"
                style={{ color: 'var(--fg-muted)' }}
              >
                {row.fg} on {row.bg}
              </td>
              <td className="num py-1.5 pr-3 text-right text-[length:var(--size-caption)]">
                {row.result?.ratio.toFixed(2)}
              </td>
              <td className="py-1.5 text-right">
                <span
                  className="display text-[length:var(--size-micro)] tracking-[0.08em]"
                  style={{
                    /* A failure is a hazard-level event for this system, so it is allowed
                       the ladder's warning colour. A pass is not chromatic — it is normal. */
                    color: passes ? 'var(--fg-muted)' : 'var(--on-warning)',
                    background: passes ? 'transparent' : 'var(--lvl-warning)',
                    padding: passes ? 0 : '0.15em 0.4em',
                  }}
                >
                  {row.essential
                    ? `EXEMPT — ${row.essential}`
                    : measured
                      ? `PASS ${row.need}:1`
                      : `FAIL — needs ${row.need}:1`}
                </span>
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}

const SWATCHES: Array<{ token: string; name: string; note: string }> = [
  { token: '--paper', name: 'paper', note: 'Citizen ground. Cool off-white, not cream.' },
  { token: '--paper-raised', name: 'paper-raised', note: 'Cards and instruments.' },
  { token: '--ink', name: 'ink', note: 'Body text.' },
  { token: '--ink-muted', name: 'ink-muted', note: 'Secondary text, borders that matter.' },
  { token: '--rule', name: 'rule', note: 'Separators only. Never a control border.' },
  { token: '--base', name: 'base', note: 'City ground.' },
  { token: '--surface', name: 'surface', note: 'City panels.' },
  { token: '--rule-dark', name: 'rule-dark', note: 'City separators.' },
  { token: '--ink-dark', name: 'ink-dark', note: 'City text.' },
  { token: '--act', name: 'act', note: 'Human action, light surface.' },
  { token: '--act-dark', name: 'act-dark', note: 'Human action, city surface.' },
];

function ColourClause() {
  // The city rows have to be read from inside a city-surfaced element, or every token
  // resolves to its citizen value and the table quietly lies.
  const cityProbe = useRef<HTMLDivElement>(null);
  const [ready, setReady] = useState(false);
  // One paint is enough for the refs to exist; this is not a loop.
  useMemo(() => {
    if (typeof queueMicrotask === 'function') queueMicrotask(() => setReady(true));
  }, []);

  return (
    <>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
        {SWATCHES.map((swatch) => (
          <div key={swatch.token} style={{ border: '1px solid var(--hairline)' }}>
            <div style={{ background: `var(${swatch.token})`, height: 56 }} />
            <div className="px-2 py-1.5" style={{ borderTop: '1px solid var(--hairline)' }}>
              <div className="display text-[length:var(--size-micro)] tracking-[0.08em]">
                {swatch.name}
              </div>
              <div
                className="mt-0.5 text-[length:var(--size-micro)] leading-snug"
                style={{ color: 'var(--fg-muted)' }}
              >
                {swatch.note}
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="mt-6">
        <div
          className="display mb-2 text-[length:var(--size-micro)] tracking-[0.14em]"
          style={{ color: 'var(--fg-muted)' }}
        >
          The IMD ladder — the only chromatic colours in the product
        </div>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {LEVEL_ORDER.map((level) => (
            <div key={level} style={{ border: '1px solid var(--hairline)' }}>
              <div
                className="flex items-center justify-center"
                style={{ background: `var(--lvl-${level})`, height: 72 }}
              >
                <LevelChip level={level} />
              </div>
              <div className="px-2 py-1.5" style={{ borderTop: '1px solid var(--hairline)' }}>
                <div className="num text-[length:var(--size-micro)]">--lvl-{level}</div>
                <div
                  className="mt-0.5 text-[length:var(--size-micro)] leading-snug"
                  style={{ color: 'var(--fg-muted)' }}
                >
                  {LEVEL_MEANING[level]}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      <Specimen label="Measured contrast — citizen surface" className="mt-8">
        <ContrastTable pairs={CITIZEN_PAIRS} element={ready ? document.documentElement : null} />
      </Specimen>

      <div className="mt-6">
        <div
          className="display mb-2 text-[length:var(--size-micro)] tracking-[0.14em]"
          style={{ color: 'var(--fg-muted)' }}
        >
          Measured contrast — city surface
        </div>
        <Surface kind="city" className="p-4">
          <div ref={cityProbe}>
            <ContrastTable pairs={CITY_PAIRS} element={ready ? cityProbe.current : null} />
          </div>
        </Surface>
      </div>

      <p
        className="mt-4 max-w-[62ch] text-[length:var(--size-caption)] leading-relaxed"
        style={{ color: 'var(--fg-muted)' }}
      >
        <strong style={{ color: 'var(--fg)', fontWeight: 600 }}>On the exempt rows.</strong>{' '}
        The ladder fills are IMD&rsquo;s published warning colours, and reproducing them is the
        information — WCAG 1.4.11 exempts a graphic whose particular presentation is
        essential. That exemption is only honest because the level is never carried by
        colour alone: the threshold line encodes it as the needle&rsquo;s position against the
        limit, and every place a fill appears, the level word appears with it. Turn the
        page greyscale and nothing becomes unreadable.
      </p>
      <p
        className="mt-3 max-w-[62ch] text-[length:var(--size-caption)] leading-relaxed"
        style={{ color: 'var(--fg-muted)' }}
      >
        These ratios are computed in the browser from the live custom properties, not copied
        from a design file. Two tokens were corrected to reach AA and the reasons are
        recorded in <span className="num">tokens.css</span>: <span className="num">--level-none</span>{' '}
        was darkened one step because neither ink nor white cleared 4.5:1 on the original
        green, and the city surface gained <span className="num">--level-none-dark</span> and{' '}
        <span className="num">--level-warning-dark</span> for the same reason{' '}
        <span className="num">--act-dark</span> already existed.
      </p>
    </>
  );
}

/* ------------------------------------------------------------------------------------ */
/* §3 The threshold line                                                                  */
/* ------------------------------------------------------------------------------------ */

const FLOOD_BANDS: Band[] = mock.levelBands('flood');
const LANDSLIDE_BANDS: Band[] = mock.levelBands('landslide');

/** A value comfortably inside each band, so all four states can be shown at once. */
function midOfBand(bands: Band[], level: Level): number {
  const band = bands.find((b) => b.level === level)!;
  const top = band.max ?? band.min * 1.35;
  return Math.round((band.min + (top - band.min) * 0.55) * 100) / 100;
}

/** Wind and air quality are not modelled yet; these bands prove the component is unit-blind. */
const WIND_BANDS: Band[] = [
  { level: 'none', min: 0, max: 8 },
  { level: 'watch', min: 8, max: 14 },
  { level: 'alert', min: 14, max: 20 },
  { level: 'warning', min: 20, max: null },
];

const HEAT_BANDS: Band[] = [
  { level: 'none', min: 26, max: 28 },
  { level: 'watch', min: 28, max: 30 },
  { level: 'alert', min: 30, max: 32 },
  { level: 'warning', min: 32, max: null },
];

const AQI_BANDS: Band[] = [
  { level: 'none', min: 0, max: 50 },
  { level: 'watch', min: 50, max: 100 },
  { level: 'alert', min: 100, max: 200 },
  { level: 'warning', min: 200, max: null },
];

/** The live demonstration: drag the forecast across the household's limit. */
function ScrubDemo() {
  const bands = FLOOD_BANDS;
  const threshold = 30;
  const [current, setCurrent] = useState(14);

  return (
    <div>
      <ThresholdLine
        current={current}
        threshold={threshold}
        unit="cm"
        bands={bands}
        size="lg"
        showBands
        label="Demonstration: flood depth against a 30 cm household limit"
      />
      <label
        className="display mt-5 block text-[length:var(--size-micro)] tracking-[0.14em]"
        style={{ color: 'var(--fg-muted)' }}
        htmlFor="scrub"
      >
        Forecast depth — drag or use the arrow keys
      </label>
      <input
        id="scrub"
        className="ng-scrub"
        type="range"
        min={0}
        max={75}
        step={0.5}
        value={current}
        onChange={(event) => setCurrent(Number(event.target.value))}
        aria-valuetext={`${formatValue(current, 'cm')}, household limit ${formatValue(threshold, 'cm')}`}
      />
    </div>
  );
}

function ThresholdClause() {
  const units: Array<{ label: string; unit: HazardUnit; bands: Band[]; current: number; threshold: number }> = [
    { label: 'Flood — Kochi, centimetres', unit: 'cm', bands: FLOOD_BANDS, current: 34.2, threshold: 30 },
    {
      label: 'Landslide — Wayanad, probability',
      unit: 'probability',
      bands: LANDSLIDE_BANDS,
      current: 0.49,
      threshold: 0.4,
    },
    { label: 'Heat — wet-bulb °C', unit: 'C_wbgt', bands: HEAT_BANDS, current: 30.6, threshold: 30 },
    { label: 'Wind — metres per second', unit: 'm_s', bands: WIND_BANDS, current: 11.4, threshold: 14 },
    { label: 'Air quality — AQI', unit: 'aqi', bands: AQI_BANDS, current: 168, threshold: 100 },
  ];

  return (
    <>
      <Specimen label="Live — the threshold crossing">
        <ScrubDemo />
      </Specimen>

      <div className="mt-8">
        <div
          className="display mb-3 text-[length:var(--size-micro)] tracking-[0.14em]"
          style={{ color: 'var(--fg-muted)' }}
        >
          All four rungs of the ladder — flood, against a 30 cm limit
        </div>
        <div className="grid gap-7 sm:grid-cols-2">
          {LEVEL_ORDER.map((level) => (
            <div key={level}>
              <div className="mb-3">
                <LevelChip level={level} size="sm" />
              </div>
              <ThresholdLine
                current={midOfBand(FLOOD_BANDS, level)}
                threshold={30}
                unit="cm"
                bands={FLOOD_BANDS}
                size="md"
                showBands
                label={`Flood at level ${LEVEL_WORD[level]} against a 30 cm household limit`}
              />
            </div>
          ))}
        </div>
      </div>

      <div className="mt-10">
        <div
          className="display mb-3 text-[length:var(--size-micro)] tracking-[0.14em]"
          style={{ color: 'var(--fg-muted)' }}
        >
          One component, five units, no modification
        </div>
        <div className="grid gap-7 sm:grid-cols-2">
          {units.map((spec) => (
            <div key={spec.label}>
              <div
                className="mb-3 text-[length:var(--size-caption)]"
                style={{ color: 'var(--fg-muted)' }}
              >
                {spec.label}
              </div>
              <ThresholdLine
                current={spec.current}
                threshold={spec.threshold}
                unit={spec.unit}
                bands={spec.bands}
                size="md"
                showBands
                label={spec.label}
              />
            </div>
          ))}
        </div>
      </div>

      <div className="mt-10">
        <div
          className="display mb-3 text-[length:var(--size-micro)] tracking-[0.14em]"
          style={{ color: 'var(--fg-muted)' }}
        >
          Three sizes — the same instrument on a card, in a list, and in the 3D scene
        </div>
        <div className="space-y-6">
          {(['lg', 'md', 'sm'] as const).map((size) => (
            <div key={size}>
              <div className="num mb-2 text-[length:var(--size-micro)]" style={{ color: 'var(--fg-muted)' }}>
                size="{size}"
              </div>
              <ThresholdLine
                current={34.2}
                threshold={30}
                unit="cm"
                bands={FLOOD_BANDS}
                size={size}
                label={`Flood forecast against a 30 cm limit, ${size} size`}
              />
            </div>
          ))}
        </div>
      </div>

      <div className="mt-10">
        <div
          className="display mb-3 text-[length:var(--size-micro)] tracking-[0.14em]"
          style={{ color: 'var(--fg-muted)' }}
        >
          On the city surface
        </div>
        <Surface kind="city" className="p-5">
          <div className="grid gap-7 sm:grid-cols-2">
            {(['watch', 'warning'] as const).map((level) => (
              <div key={level}>
                <div className="mb-3">
                  <LevelChip level={level} size="sm" />
                </div>
                <ThresholdLine
                  current={midOfBand(FLOOD_BANDS, level)}
                  threshold={30}
                  unit="cm"
                  bands={FLOOD_BANDS}
                  size="md"
                  showBands
                  label={`City surface, level ${LEVEL_WORD[level]}`}
                />
              </div>
            ))}
          </div>
        </Surface>
      </div>
    </>
  );
}

/* ------------------------------------------------------------------------------------ */
/* §4 Status card                                                                         */
/* ------------------------------------------------------------------------------------ */

const GROUND_FLOOR: Profile = {
  buildingType: 'independent',
  floorLevel: 0,
  householdSize: 4,
  hasElderly: true,
  hasLimitedMobility: true,
  hasVehicle: false,
  language: 'ml',
};

const THIRD_FLOOR: Profile = {
  buildingType: 'apartment',
  floorLevel: 3,
  householdSize: 2,
  hasElderly: false,
  hasLimitedMobility: false,
  hasVehicle: true,
  language: 'ml',
};

function StatusCardClause() {
  // Real answers from the mock, not hand-written fixtures: the same street, the same
  // rainfall, two households. If the model stops differentiating, this page shows it.
  const scenario = { city: 'kochi', zoneId: 'kaloor', hazard: 'flood' as const, intensity: 120 };
  const ground = mock.threshold({ ...scenario, profile: GROUND_FLOOR });
  const third = mock.threshold({ ...scenario, profile: THIRD_FLOOR });

  return (
    <>
      <p
        className="mb-5 max-w-[62ch] text-[length:var(--size-small)] leading-relaxed"
        style={{ color: 'var(--fg-muted)' }}
      >
        Both cards below are the same zone, the same hazard and the same rainfall — 120 mm/h
        over Kaloor. The only difference is the household. This is the product claim, and
        the numbers come from <span className="num">mock.ts</span>, not from fixtures.
      </p>
      <div className="grid gap-6 lg:grid-cols-2">
        <div>
          <div
            className="display mb-2 text-[length:var(--size-micro)] tracking-[0.14em]"
            style={{ color: 'var(--fg-muted)' }}
          >
            Ground floor · someone needs help to move · no vehicle
          </div>
          <StatusCard
            hazardLabel="Flood · Kaloor"
            level={ground.level}
            current={ground.exposure}
            threshold={ground.threshold}
            unit={ground.unit}
            bands={FLOOD_BANDS}
            action={ground.action}
            actionMl={ground.action_ml}
            crossesAtMin={ground.crossesAtMin}
            leadTimeMin={ground.leadTimeMin}
            reasons={ground.reasons}
          />
        </div>
        <div>
          <div
            className="display mb-2 text-[length:var(--size-micro)] tracking-[0.14em]"
            style={{ color: 'var(--fg-muted)' }}
          >
            Third floor · apartment · has a vehicle
          </div>
          <StatusCard
            hazardLabel="Flood · Kaloor"
            level={third.level}
            current={third.exposure}
            threshold={third.threshold}
            unit={third.unit}
            bands={FLOOD_BANDS}
            action={third.action}
            actionMl={third.action_ml}
            crossesAtMin={third.crossesAtMin}
            leadTimeMin={third.leadTimeMin}
            reasons={third.reasons}
          />
        </div>
      </div>
    </>
  );
}

/* ------------------------------------------------------------------------------------ */
/* §5–§7                                                                                  */
/* ------------------------------------------------------------------------------------ */

function ButtonClause() {
  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <Specimen label="Citizen surface">
        <div className="flex flex-wrap items-center gap-3">
          <Button variant="primary">Register your household</Button>
          <Button variant="quiet">Not now</Button>
        </div>
        <div className="mt-4">
          <Button variant="emergency" size="lg" style={{ width: '100%' }}>
            Get help
          </Button>
        </div>
        <p
          className="mt-3 text-[length:var(--size-caption)] leading-relaxed"
          style={{ color: 'var(--fg-muted)' }}
        >
          The emergency control is the only loud element in the product, and the only one
          allowed the 64 px target.
        </p>
      </Specimen>

      <div>
        <div
          className="display mb-2 text-[length:var(--size-micro)] tracking-[0.14em]"
          style={{ color: 'var(--fg-muted)' }}
        >
          City surface
        </div>
        <Surface kind="city" className="p-4">
          <div className="flex flex-wrap items-center gap-3">
            <Button variant="primary">Acknowledge</Button>
            <Button variant="quiet">Dismiss</Button>
          </div>
          <div className="mt-4">
            <Button variant="emergency" size="lg" style={{ width: '100%' }}>
              Escalate to district control
            </Button>
          </div>
          <p
            className="mt-3 text-[length:var(--size-caption)] leading-relaxed"
            style={{ color: 'var(--fg-muted)' }}
          >
            Same components, no branching — only the bound tokens changed.
          </p>
        </Surface>
      </div>
    </div>
  );
}

function ChipClause() {
  const chips = (
    <div className="flex flex-wrap items-center gap-2">
      {LEVEL_ORDER.map((level) => (
        <LevelChip key={level} level={level} />
      ))}
      {/* All three data-source states. The live chip in the header shows whichever one
          is currently true; these are the other two, so the set can be compared. */}
      <StatusChipView status="live" />
      <StatusChipView status="simulated" />
      <StatusChipView status="offline" />
    </div>
  );

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <Specimen label="Citizen surface">{chips}</Specimen>
      <div>
        <div
          className="display mb-2 text-[length:var(--size-micro)] tracking-[0.14em]"
          style={{ color: 'var(--fg-muted)' }}
        >
          City surface
        </div>
        <Surface kind="city" className="p-4">
          {chips}
        </Surface>
      </div>
    </div>
  );
}

function StatesClause() {
  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <EmptyState
        heading="No household registered yet"
        body="Register this address once and every warning after it is about your house — your floor, your street, the people in it."
        actionLabel="Register your household"
      />
      <ErrorState
        heading="Cannot reach the forecast service"
        whatHappened="The last update was 40 minutes ago. The numbers on screen are the committed scenario, not live readings."
        howToFix="Nothing to do — the app keeps working offline and will reconnect on its own. Emergency requests you send are queued and delivered when it does."
        actionLabel="Check again"
      />
    </div>
  );
}

/* ------------------------------------------------------------------------------------ */
/* The sheet                                                                              */
/* ------------------------------------------------------------------------------------ */

export default function Styleguide() {
  return (
    <div className="mx-auto w-full max-w-[68rem] px-5 py-8">
      {/* Masthead. A specimen sheet states what it is, what it covers and when it was
          issued — the same furniture a public standards document carries. */}
      <header>
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <div
              className="display text-[length:var(--size-micro)] tracking-[0.2em]"
              style={{ color: 'var(--fg-muted)' }}
            >
              Nagaranetra · Design system
            </div>
            <h1
              className="display mt-1 text-[length:var(--size-display)] leading-[0.9]"
              style={{ fontWeight: 800 }}
            >
              Specimen sheet
            </h1>
          </div>
          <dl
            className="num text-[length:var(--size-micro)]"
            style={{ color: 'var(--fg-muted)' }}
          >
            <div className="flex gap-2">
              <dt>Sheet</dt>
              <dd style={{ color: 'var(--fg)' }}>01 of 01</dd>
            </div>
            <div className="flex gap-2">
              <dt>Issued</dt>
              <dd style={{ color: 'var(--fg)' }}>2026-08-18</dd>
            </div>
            <div className="flex gap-2">
              <dt>Governs</dt>
              <dd style={{ color: 'var(--fg)' }}>CLAUDE.md §5</dd>
            </div>
          </dl>
        </div>
        <hr className="sheet-rule mt-4" style={{ borderTopWidth: 3 }} />
        <p className="mt-4 max-w-[62ch] text-[length:var(--size-body)] leading-relaxed">
          The subject is public safety infrastructure, not a tech product. Colour is reserved
          entirely for hazard level and one action blue; the interface is achromatic until
          something is wrong. Every value on this sheet is read from{' '}
          <span className="num">tokens.css</span> at runtime.
        </p>
      </header>

      <Clause
        n="1"
        title="Typography"
        rule="Archivo for display, in condensed heavy weights and status words only. Inter for body. Noto Sans Malayalam for Malayalam, scoped by unicode-range so mixed lines shape correctly. IBM Plex Mono, tabular, for every number that can change."
      >
        <TypographyClause />
      </Clause>

      <Clause
        n="2"
        title="Colour and contrast"
        rule="Colour means hazard level, or it means a person can act. Nothing else is chromatic — no brand colour, no gradients, no decorative accents. Every ratio below is measured in the browser; a token that fails WCAG AA is a defect, not a note."
      >
        <ColourClause />
      </Clause>

      <Clause
        n="3"
        title="The threshold line"
        rule="The signature element. Every hazard is a number approaching a limit, so there is one instrument for all of them: a graduated track, the household's own limit painted on it, and a needle for the forecast. The fill carries the IMD level and is the only chromatic part; the limit and the needle are ink, because neither is a hazard level."
      >
        <ThresholdClause />
      </Clause>

      <Clause
        n="4"
        title="Status card"
        rule="The action is the largest element on a citizen screen. A resident under stress needs the instruction before the number, and the number before the reasoning."
      >
        <StatusCardClause />
      </Clause>

      <Clause
        n="5"
        title="Buttons"
        rule="Blue is what a person does. Red is asking for help, and it is the only loud element in the product. Everything else is achromatic. Press feedback lands on pointer-down; the action itself fires on release, so a press can still be cancelled by sliding off."
      >
        <ButtonClause />
      </Clause>

      <Clause
        n="6"
        title="Chips"
        rule="A chip states a fact about the system: what the hazard level is, or where the data came from. The data-source chip is never hidden and has no dismiss control."
      >
        <ChipClause />
      </Clause>

      <Clause
        n="7"
        title="Empty and error states"
        rule="An empty screen is an invitation to act. An error says what happened, what it means for this person, and the one thing that fixes it — never 'try again later'."
      >
        <StatesClause />
      </Clause>

      <Clause
        n="8"
        title="Motion"
        rule="One orchestrated moment: the threshold crossing. The fill, the needle and the limit stamp are driven by a single spring, so they land on the same beat by construction. Everything else is a plain transition on a named property. Under prefers-reduced-motion, movement drops and opacity survives."
      >
        <Specimen label="Verify">
          <p className="text-[length:var(--size-small)] leading-relaxed">
            Set “Reduce motion” in your operating system and drag the scrubber in §3. The
            needle should jump to its value instead of springing to it, while the fill colour
            still steps up the ladder — the information survives, the movement does not.
          </p>
          <p
            className="mt-3 text-[length:var(--size-caption)] leading-relaxed"
            style={{ color: 'var(--fg-muted)' }}
          >
            Nothing on this page animates on load, and nothing animates on hover except a
            brightness change on buttons, gated behind a fine-pointer media query so a tap
            does not leave a stuck hover state.
          </p>
        </Specimen>
      </Clause>

      <hr className="sheet-hair mt-14" />
      <p
        className="mt-3 text-[length:var(--size-micro)]"
        style={{ color: 'var(--fg-muted)' }}
      >
        Hazard values on this sheet are modelled and labelled as simulated. Geometry, zones
        and ward names are placeholders pending the city hazard profiler.
      </p>
    </div>
  );
}
