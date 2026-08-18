/**
 * The household status card — what one house is being told, right now.
 *
 * Hierarchy is the whole design here. The largest thing on the card, and on the citizen
 * screen, is the ACTION: a resident under stress needs the instruction before the number,
 * and certainly before the reasoning. So the order down the card is
 *
 *    level word  ->  what to do  ->  the instrument  ->  when  ->  why
 *
 * which is also the order a person actually needs it in. The number is not the headline;
 * the number is evidence for the headline.
 */
import type { Band, HazardUnit, Level } from '../lib/contract';
import { LevelChip } from './LevelChip';
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
  /** Shown verbatim — these are facts the resident recognises about their own house. */
  reasons: string[];
};

/** "45 min" / "2 h 15 min" — never a bare number of minutes past an hour. */
function formatMinutes(minutes: number): string {
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return rest === 0 ? `${hours} h` : `${hours} h ${rest} min`;
}

export function StatusCard(props: StatusCardProps) {
  const { crossesAtMin, leadTimeMin } = props;

  /* The honest comparison, and the reason this product exists: not "when does it cross"
     but "does it cross before this household can be ready". */
  const tooLate = crossesAtMin !== null && crossesAtMin < leadTimeMin;

  return (
    <article
      className="w-full"
      style={{
        background: 'var(--bg-raised)',
        border: '1px solid var(--edge)',
        borderRadius: 'var(--radius-md)',
      }}
    >
      <header
        className="flex items-center justify-between gap-3 px-4 py-3"
        style={{ borderBottom: '1px solid var(--hairline)' }}
      >
        <span
          className="display text-[length:var(--size-micro)] tracking-[0.14em]"
          style={{ color: 'var(--fg-muted)' }}
        >
          {props.hazardLabel}
        </span>
        <LevelChip level={props.level} />
      </header>

      <div className="px-4 py-5">
        {/* The largest element on the citizen screen. Set in the body face, not the
            display face: CLAUDE.md §5 keeps heavy display weights for status words, and
            an instruction is a sentence a person has to read, not a stamp. */}
        <p
          className="text-[length:var(--size-action)] leading-[1.15]"
          style={{ fontWeight: 600, letterSpacing: '-0.015em' }}
        >
          {props.action}
        </p>
        {props.actionMl && (
          <p
            className="font-mal mt-2 text-[length:var(--size-body)] leading-snug"
            style={{ color: 'var(--fg-muted)' }}
            lang="ml"
          >
            {props.actionMl}
          </p>
        )}

        <div className="mt-6">
          <ThresholdLine
            current={props.current}
            threshold={props.threshold}
            unit={props.unit}
            bands={props.bands}
            size="lg"
            label={`${props.hazardLabel}: forecast against this household's limit`}
          />
        </div>

        <dl
          className="mt-6 grid grid-cols-2 gap-x-4 gap-y-1"
          style={{ borderTop: '1px solid var(--hairline)', paddingTop: '0.9rem' }}
        >
          <dt className="text-[length:var(--size-caption)]" style={{ color: 'var(--fg-muted)' }}>
            {crossesAtMin === null ? 'Your limit' : 'Crosses your limit in'}
          </dt>
          <dt className="text-[length:var(--size-caption)]" style={{ color: 'var(--fg-muted)' }}>
            You need
          </dt>
          <dd className="num text-[length:var(--size-num-lg)]" style={{ fontWeight: 500 }}>
            {crossesAtMin === null ? 'Not reached' : formatMinutes(crossesAtMin)}
          </dd>
          <dd className="num text-[length:var(--size-num-lg)]" style={{ fontWeight: 500 }}>
            {formatMinutes(leadTimeMin)}
          </dd>
        </dl>

        {tooLate && (
          <p
            className="mt-3 text-[length:var(--size-small)]"
            style={{ color: 'var(--lvl-warning)', fontWeight: 600 }}
          >
            You need longer to move than you have. Ask for help now.
          </p>
        )}

        {props.reasons.length > 0 && (
          <div className="mt-5">
            <h3
              className="display text-[length:var(--size-micro)] tracking-[0.14em]"
              style={{ color: 'var(--fg-muted)' }}
            >
              Why this is different for your house
            </h3>
            <ul className="mt-2 flex flex-wrap gap-x-2 gap-y-1.5">
              {props.reasons.map((reason) => (
                <li
                  key={reason}
                  className="text-[length:var(--size-caption)]"
                  style={{
                    border: '1px solid var(--hairline)',
                    borderRadius: 'var(--radius-sm)',
                    padding: '0.2em 0.5em',
                    color: 'var(--fg-muted)',
                  }}
                >
                  {reason}
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </article>
  );
}
