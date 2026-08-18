/**
 * THE THRESHOLD LINE — the signature element (CLAUDE.md §5).
 *
 * Every hazard is the same story: a number approaching a limit. Water in cm, wet-bulb in
 * °C, wind in m/s, particulates in AQI. So there is one instrument for all of them, and
 * it is the thing the product is remembered by. It appears on the status card, in the
 * forecast sparkline, and in the 3D scene as the level marker — the same object at three
 * sizes, so a resident learns to read it once.
 *
 * WHAT IT IS. A gauge, in the vernacular of the depth staffs painted on Indian bridge
 * piers and canal walls: a graduated track, a painted limit line, and a needle.
 *
 *   YOUR LIMIT 30 cm
 *            ┃                              <- the limit: fixed, achromatic, above
 *   ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 *   ████████████▊                           <- fill: the level colour, how far it has come
 *              ┃                            <- the needle: where it is now, below
 *              34 cm
 *
 * WHY THE COLOUR IS WHERE IT IS. The fill is the only chromatic thing, and it carries the
 * IMD level. The limit and the needle are ink, because the limit belongs to the household
 * and the needle is a reading — neither is a hazard level, and CLAUDE.md §5 reserves
 * colour for hazard levels alone. It also means the value stays legible against a yellow
 * fill, which no amount of colour tuning would fix.
 *
 * THE ORCHESTRATED MOMENT. When the forecast crosses the limit, the fill, the needle and
 * the limit stamp all move on one spring, because they are driven by one motion value —
 * the beat is a consequence of the construction, not choreography laid on top.
 */
import { useEffect, useId, useRef } from 'react';
import { motion, useMotionValue, useReducedMotion, useSpring, useTransform } from 'motion/react';
import type { Band, HazardUnit, Level } from '../lib/contract';
import { levelFor } from '../lib/mock';
import { formatValue, levelTokens } from '../lib/levels';

export type ThresholdLineProps = {
  /** Where the forecast sits now, in `unit`. */
  current: number;
  /** This household's limit, in `unit`. Drawn as the painted line. */
  threshold: number;
  unit: HazardUnit;
  /** The hazard's bands, straight from the contract. Decide the level and the scale. */
  bands: Band[];
  /** Optional hard end for the scale. Derived from the bands when absent. */
  max?: number;
  size?: 'sm' | 'md' | 'lg';
  /** Show the ladder as a strip under the track. On for the styleguide and the city
   *  dashboard, off on citizen screens — the interface is achromatic until something
   *  is wrong, and painting all four rungs at once undoes that. */
  showBands?: boolean;
  /** Accessible name. Required: this is a meter, and a meter with no name is noise. */
  label: string;
};

/**
 * Round a scale end up to a readable number — 1, 1.5, 2, 2.5, 3, 4, 5, 7.5 or 10 times a
 * power of ten. Works for 0.91 (-> 1) as well as for 39 (-> 40), which is what lets one
 * component serve probability and m/s without being told which is which.
 */
function niceCeil(value: number): number {
  if (value <= 0) return 1;
  const magnitude = 10 ** Math.floor(Math.log10(value));
  const steps = [1, 1.5, 2, 2.5, 3, 4, 5, 7.5, 10];
  const normalised = value / magnitude;
  const step = steps.find((s) => normalised <= s + 1e-9) ?? 10;
  return step * magnitude;
}

/** The scale runs from the bottom of the first band to a little past the top rung. */
function domainFor(bands: Band[], current: number, threshold: number, max?: number) {
  const min = bands[0]?.min ?? 0;
  const topRung = bands[bands.length - 1]?.min ?? 1;
  const end = max ?? niceCeil(Math.max(topRung * 1.4, current * 1.1, threshold * 1.1, min + 1e-6));
  return { min, max: end };
}

const TRACK_HEIGHT = { sm: 6, md: 12, lg: 18 } as const;

export function ThresholdLine({
  current,
  threshold,
  unit,
  bands,
  max,
  size = 'md',
  showBands = false,
  label,
}: ThresholdLineProps) {
  const reduceMotion = useReducedMotion();
  const domain = domainFor(bands, current, threshold, max);
  const span = Math.max(domain.max - domain.min, 1e-9);

  const toPercent = (value: number) =>
    Math.min(100, Math.max(0, ((value - domain.min) / span) * 100));

  const currentPercent = toPercent(current);
  const thresholdPercent = toPercent(threshold);
  const level: Level = levelFor(bands, current);
  const { fill } = levelTokens(level);
  const crossed = current >= threshold;

  /**
   * One motion value drives the fill and the needle, which is what makes them land on the
   * same beat. A spring rather than a duration because the scrubber can drag this value
   * and springs keep their velocity when interrupted — a duration would restart from zero
   * every frame of a drag.
   */
  const percent = useMotionValue(currentPercent);
  /*
   * Physical parameters rather than the { duration, bounce } form: at this call site the
   * duration was being read as milliseconds and the spring settled inside a single frame,
   * which scripts/verify-a11y.mjs caught by counting intermediate positions.
   *
   * Damping is set just below critical (ratio ~0.93), so the needle settles in about
   * 300 ms with no overshoot. That is not a stylistic choice: this is a gauge, and a gauge
   * that overshoots displays a depth the model never predicted, however briefly.
   */
  const springy = useSpring(percent, { stiffness: 260, damping: 30, mass: 1, restDelta: 0.01 });
  // Reduced motion: movement drops, everything else survives (CLAUDE.md §5).
  const tracked = reduceMotion ? percent : springy;

  // Skip the spring on first paint: the instrument should not sweep up from zero on load.
  const mounted = useRef(false);
  useEffect(() => {
    if (!mounted.current) {
      mounted.current = true;
      percent.jump(currentPercent);
      return;
    }
    percent.set(currentPercent);
  }, [currentPercent, percent]);

  const needleTransform = useTransform(tracked, (value) => `translateX(${value}%)`);
  const fillTransform = useTransform(tracked, (value) => `scaleX(${value / 100})`);

  const height = TRACK_HEIGHT[size];
  const titleId = useId();

  /**
   * A label centred on a marker near either end would hang outside the instrument. Near
   * the edges it aligns to that edge instead — the label still points at its marker, and
   * nothing is trimmed.
   */
  /** An empty gauge has nothing to read, so it prints no reading. */
  const showsReading = current > domain.min;

  const labelAlign = (percent: number) =>
    percent < 12 ? 'translateX(0)' : percent > 88 ? 'translateX(-100%)' : 'translateX(-50%)';

  return (
    <figure
      className="m-0 w-full"
      role="meter"
      aria-labelledby={titleId}
      aria-valuenow={current}
      aria-valuemin={domain.min}
      aria-valuemax={domain.max}
      /* Screen readers get the sentence, not the geometry: the number alone does not say
         whether it is good or bad, and this component's whole job is that comparison. */
      aria-valuetext={`${formatValue(current, unit)} of a ${formatValue(threshold, unit)} limit. ${
        crossed ? 'Limit passed.' : 'Limit not reached.'
      }`}
    >
      <figcaption id={titleId} className="sr-only">
        {label}
      </figcaption>

      {/* The limit, above the track. Fixed, ink, and stamped once it is passed. */}
      {size !== 'sm' && (
        <div className="relative mb-4 h-[1.15em]">
          <div
            className="absolute top-0 whitespace-nowrap"
            style={{ left: `${thresholdPercent}%`, transform: labelAlign(thresholdPercent) }}
          >
            <span
              className="display px-1 py-[1px] text-[length:var(--size-micro)] tracking-[0.1em] transition-colors duration-200"
              style={{
                background: crossed ? 'var(--fg)' : 'transparent',
                color: crossed ? 'var(--bg)' : 'var(--fg-muted)',
                border: `1px solid ${crossed ? 'var(--fg)' : 'transparent'}`,
              }}
            >
              Your limit {formatValue(threshold, unit)}
            </span>
          </div>
        </div>
      )}

      {/* The track. Bordered in --edge, which is the token that actually clears 3:1 —
          --rule is a separator and would leave the instrument's bounds invisible.

          overflowX: 'clip' contains the needle's transform wrapper, which is as wide as
          the track and translates by up to 100% of itself. `clip` rather than `hidden`
          because hidden would force a scroll container on BOTH axes and cut off the
          needle's overhang; clip can be set per-axis. */}
      <div
        className="relative w-full"
        style={{ height, overflowX: 'clip', overflowY: 'visible' }}
      >
        <div
          className="absolute inset-0 overflow-hidden"
          style={{ background: 'var(--bg-raised)', border: '1px solid var(--edge)' }}
        >
          <motion.div
            className="absolute inset-y-0 left-0 w-full origin-left transition-colors duration-200"
            style={{ background: fill, transform: fillTransform }}
            data-role="fill"
          />
        </div>

        {/* The limit: rises ABOVE the track and is capped with a downward triangle, the
            way a benchmark is marked on a survey staff. It never descends below the
            track, so it can never be mistaken for the needle. */}
        <div
          className="absolute -translate-x-1/2"
          style={{ left: `${thresholdPercent}%`, top: -11, bottom: 0, width: 2, background: 'var(--fg)' }}
          aria-hidden="true"
        >
          <div
            className="absolute left-1/2 -translate-x-1/2"
            style={{
              top: -1,
              width: 0,
              height: 0,
              borderLeft: '4px solid transparent',
              borderRight: '4px solid transparent',
              borderTop: '6px solid var(--fg)',
            }}
          />
        </div>

        {/* The needle: descends BELOW the track and is thicker. Opposite direction,
            different weight — the two are distinguishable at a glance and in a
            screenshot, which is the test that matters. */}
        <motion.div
          className="pointer-events-none absolute inset-y-0 left-0 w-full"
          style={{ transform: needleTransform }}
          aria-hidden="true"
          /* A stable hook for scripts/verify-a11y.mjs, which has to measure this exact
             element's transform to prove reduced motion drops the movement. */
          data-role="needle"
        >
          <div
            className="absolute -translate-x-1/2"
            style={{ top: 0, height: height + 11, width: 4, background: 'var(--fg)' }}
          />
        </motion.div>
      </div>

      {/* The ladder, only when asked for. */}
      {showBands && (
        <div className="mt-2 flex w-full" style={{ height: 4 }} aria-hidden="true">
          {bands.map((band, i) => {
            const from = toPercent(band.min);
            const to = band.max === null ? 100 : toPercent(band.max);
            return (
              <div
                key={band.level}
                style={{
                  width: `${Math.max(0, to - from)}%`,
                  background: levelTokens(band.level).fill,
                  marginLeft: i === 0 ? `${from}%` : undefined,
                }}
              />
            );
          })}
        </div>
      )}

      {/* The reading, below the needle. Tabular, so it does not jitter as it ticks.
          Suppressed when the needle is sitting on the floor of the scale: "0 cm" pinned to
          the left edge reads as a broken label rather than as a measurement, and an empty
          instrument already says there is nothing to read. */}
      {size !== 'sm' && showsReading && (
        <div className="relative mt-1.5 h-[1.3em]">
          <div
            className="absolute top-0 whitespace-nowrap"
            style={{ left: `${currentPercent}%`, transform: labelAlign(currentPercent) }}
          >
            <span
              className="num text-[length:var(--size-num-md)]"
              style={{ color: 'var(--fg)', fontWeight: 500 }}
            >
              {formatValue(current, unit)}
            </span>
          </div>
        </div>
      )}

      {/* Scale ends. Suppressed when the needle is sitting on top of one: two numbers in
          the same place is worse than one number missing, and the reading wins. */}
      {size === 'lg' && (
        <div
          className="num mt-1 flex justify-between text-[length:var(--size-micro)]"
          style={{ color: 'var(--fg-muted)' }}
          aria-hidden="true"
        >
          <span style={{ visibility: showsReading && currentPercent < 14 ? 'hidden' : undefined }}>
            {formatValue(domain.min, unit)}
          </span>
          <span style={{ visibility: showsReading && currentPercent > 86 ? 'hidden' : undefined }}>
            {formatValue(domain.max, unit)}
          </span>
        </div>
      )}
    </figure>
  );
}
