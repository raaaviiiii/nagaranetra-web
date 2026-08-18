/**
 * The household status card — what one house is being told, right now.
 *
 * ONE IDEA. The card says a single thing: what to do. That sentence gets --size-hero and
 * it gets the room to be read from across a room, and nothing else on the card is allowed
 * near its weight. The level word, the instrument, the timings and the reasoning are all
 * evidence for it, and they descend the scale in that order.
 *
 * An earlier version packed seven blocks of near-identical weight into this card — the
 * level, the action, the Malayalam, the instrument, two numbers, a warning line and a row
 * of bordered reason chips. Everything was legible and nothing was dominant, which in an
 * emergency is the same as nothing being legible. The reasons are now one quiet line, the
 * chips are gone, and the instrument has real space above and below it.
 */
import type { Band, HazardUnit, Level } from '../lib/contract';
import { LevelChip } from './LevelChip';
import { Stat } from './Stat';
import { ThresholdLine } from './ThresholdLine';

export type StatusCardProps = {
  /** What this card is about, e.g. "Flood · Kaloor". */
  hazardLabel: string;
  level: Level;
  current: number;
  threshold: number;
  unit: HazardUnit;
  bands: Band[];
  action: string;
  actionMl?: string;
  /** Minutes until the limit is crossed; null when it is not expected to be. */
  crossesAtMin: number | null;
  /** Minutes this household needs to act. */
  leadTimeMin: number;
  /** Shown verbatim — facts the resident recognises about their own house. */
  reasons: string[];
};

/** "45 min" / "2 h 15 min" — never a bare count of minutes past an hour. */
function formatMinutes(minutes: number): string {
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return rest === 0 ? `${hours} h` : `${hours} h ${rest} min`;
}

export function StatusCard(props: StatusCardProps) {
  const { crossesAtMin, leadTimeMin } = props;

  /* The comparison this product exists to make: not "when does it cross" but "does it
     cross before this household can be ready". */
  const tooLate = crossesAtMin !== null && crossesAtMin < leadTimeMin;

  return (
    <article
      style={{
        background: 'var(--bg-raised)',
        border: '1px solid var(--hairline)',
        borderRadius: 'var(--radius-md)',
        padding: 'var(--space-lg)',
      }}
    >
      <header className="flex items-center justify-between gap-4">
        <span className="ng-label">{props.hazardLabel}</span>
        <LevelChip level={props.level} />
      </header>

      {/* The one dominant element on the screen. */}
      <p
        style={{
          marginTop: 'var(--space-lg)',
          fontSize: 'var(--size-hero)',
          lineHeight: 1.05,
          letterSpacing: '-0.025em',
          fontWeight: 600,
          textWrap: 'balance',
        }}
      >
        {props.action}
      </p>

      {props.actionMl && (
        <p
          className="font-mal"
          lang="ml"
          style={{
            marginTop: 'var(--space-sm)',
            fontSize: 'var(--size-lead)',
            lineHeight: 1.5,
            color: 'var(--fg-muted)',
          }}
        >
          {props.actionMl}
        </p>
      )}

      {/* The instrument, with room. It is the second idea, not a fourth. */}
      <div style={{ marginTop: 'var(--space-xl)' }}>
        <ThresholdLine
          current={props.current}
          threshold={props.threshold}
          unit={props.unit}
          bands={props.bands}
          size="lg"
          label={`${props.hazardLabel}: forecast against this household's limit`}
        />
      </div>

      <div
        className="grid grid-cols-2 gap-4"
        style={{
          marginTop: 'var(--space-xl)',
          paddingTop: 'var(--space-md)',
          borderTop: '1px solid var(--hairline)',
        }}
      >
        <Stat
          label={crossesAtMin === null ? 'Your limit' : 'Crosses your limit in'}
          value={crossesAtMin === null ? 'Not reached' : formatMinutes(crossesAtMin)}
          tone={tooLate ? 'warning' : undefined}
        />
        <Stat label="You need" value={formatMinutes(leadTimeMin)} />
      </div>

      {tooLate && (
        <p
          style={{
            marginTop: 'var(--space-md)',
            fontSize: 'var(--size-body)',
            fontWeight: 600,
            color: 'var(--lvl-warning)',
            lineHeight: 1.35,
          }}
        >
          You need longer to move than you have. Ask for help now.
        </p>
      )}

      {/* One quiet line. These were bordered chips, which gave reasoning the same weight
          as the instruction it explains. */}
      {props.reasons.length > 0 && (
        <p
          style={{
            marginTop: 'var(--space-md)',
            fontSize: 'var(--size-caption)',
            color: 'var(--fg-muted)',
            lineHeight: 1.5,
          }}
        >
          Because of your house: {props.reasons.join(' · ').toLowerCase()}
        </p>
      )}
    </article>
  );
}
