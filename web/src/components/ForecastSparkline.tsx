/**
 * The next six hours on this street.
 *
 * WHAT THIS PLOTS, AND WHY IT IS NOT THE HOUSEHOLD CURVE. `/forecast` returns zone
 * exposure per frame; the household modifier lives inside `/household/threshold`, which
 * answers for now only. Drawing a household curve would mean reimplementing the backend's
 * stage-2 model in the browser — the exact drift the frozen contract exists to prevent,
 * and a second model that could disagree with the first in front of a jury.
 *
 * So this plots what the service actually returned: the water on the street. The moment
 * that matters to this household — the crossing the service computed — is marked on it.
 * Every number here came from a response; none was derived.
 *
 * The horizon advances linearly (CLAUDE.md §6). Easing the clock would compress hours into
 * the first instant and make the near future look calmer than it is.
 */
import {
  CartesianGrid,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  XAxis,
  YAxis,
} from 'recharts';
import type { Forecast, HazardUnit, Level } from '../lib/contract';
import { UNIT_LABEL, levelTokens } from '../lib/levels';

/** "+2 h", "+30 min" — an offset from now, never a clock time we cannot vouch for. */
function offsetLabel(minutes: number): string {
  if (minutes === 0) return 'Now';
  if (minutes % 60 === 0) return `+${minutes / 60} h`;
  return `+${minutes} min`;
}

export function ForecastSparkline({
  forecast,
  zoneId,
  crossesAtMin,
  level,
  unit,
}: {
  forecast: Forecast;
  zoneId: string;
  /** From /household/threshold. Null when the limit is not expected to be reached. */
  crossesAtMin: number | null;
  level: Level;
  unit: HazardUnit;
}) {
  const series = forecast.frames.map((frame) => ({
    t: frame.offsetMin,
    value: frame.zones.find((zone) => zone.id === zoneId)?.exposure ?? 0,
  }));

  const peak = Math.max(...series.map((point) => point.value), 1);

  return (
    <figure className="m-0">
      <figcaption
        className="display mb-1 text-[length:var(--size-micro)] tracking-[0.14em]"
        style={{ color: 'var(--fg-muted)' }}
      >
        Water on your street — next six hours ({UNIT_LABEL[unit]})
      </figcaption>
      <p className="mb-3 text-[length:var(--size-caption)]" style={{ color: 'var(--fg-muted)' }}>
        {crossesAtMin === null
          ? 'It is not expected to reach your limit.'
          : `Your limit is reached ${offsetLabel(crossesAtMin).toLowerCase().replace('+', 'in ')}.`}
      </p>

      <div style={{ height: 140 }}>
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={series} margin={{ top: 18, right: 10, bottom: 0, left: 0 }}>
            <CartesianGrid stroke="var(--hairline)" vertical={false} />
            <XAxis
              dataKey="t"
              type="number"
              domain={[0, series.at(-1)?.t ?? 360]}
              ticks={[0, 120, 240, 360]}
              tickFormatter={offsetLabel}
              stroke="var(--fg-muted)"
              tick={{ fontSize: 11, fontFamily: 'var(--font-num)', fill: 'var(--fg-muted)' }}
              tickLine={false}
              axisLine={{ stroke: 'var(--edge)' }}
            />
            <YAxis
              width={34}
              domain={[0, Math.ceil(peak / 10) * 10]}
              /* Bare numbers: the unit is in the caption. "90 cm" wrapped onto two lines
                 at this width and clipped the top tick. */
              tickFormatter={(value: number) => String(Math.round(value))}
              stroke="var(--fg-muted)"
              tick={{ fontSize: 11, fontFamily: 'var(--font-num)', fill: 'var(--fg-muted)' }}
              tickLine={false}
              axisLine={false}
            />

            {/* The one chromatic mark: where this household's limit is reached. */}
            {crossesAtMin !== null && (
              <ReferenceLine
                x={crossesAtMin}
                stroke={levelTokens(level).fill}
                strokeWidth={3}
                /* Above the line, not inside the plot: at an early crossing the inside
                   position printed the label straight over the y-axis ticks. */
                label={{
                  value: 'Your limit',
                  position: 'top',
                  fontSize: 11,
                  fill: 'var(--fg)',
                  fontFamily: 'var(--font-display)',
                }}
              />
            )}

            <Line
              type="monotone"
              dataKey="value"
              stroke="var(--fg)"
              strokeWidth={2}
              dot={false}
              // The chart redraws on data change, not on mount: an animated line implies
              // the water is rising as you watch, which it is not.
              isAnimationActive={false}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </figure>
  );
}
