/**
 * How full a shelter is.
 *
 * A number alone ("145 of 300") makes a person do arithmetic while deciding where to take
 * their family. The bar answers "is there room" before the number is read.
 *
 * Achromatic while there is room, because a shelter filling up is not a hazard level and
 * §5 keeps the ladder for hazards. It turns to the warning rung only when it is actually
 * full — at that point it IS a safety condition, and the number stops being the point.
 */
export function CapacityBar({
  occupancy,
  capacity,
  label = 'Shelter capacity',
}: {
  occupancy: number;
  capacity: number;
  /** The accessible name. A meter with a value and no name announces a number about nothing. */
  label?: string;
}) {
  const safeCapacity = Math.max(1, capacity);
  const ratio = Math.min(1, Math.max(0, occupancy / safeCapacity));
  const spaces = Math.max(0, capacity - occupancy);
  const full = spaces === 0;

  return (
    <div>
      <div
        className="flex items-baseline justify-between"
        style={{ gap: 'var(--space-md)', marginBottom: 'var(--space-xs)' }}
      >
        <span className="ng-label">{full ? 'Full' : 'Space for'}</span>
        <span
          className="num"
          style={{
            fontSize: 'var(--size-num-lead)',
            fontWeight: 500,
            color: full ? 'var(--lvl-warning)' : 'var(--fg)',
            lineHeight: 1,
          }}
        >
          {full ? '0' : spaces}
        </span>
      </div>

      <div
        role="meter"
        aria-label={label}
        aria-valuenow={occupancy}
        aria-valuemin={0}
        aria-valuemax={capacity}
        aria-valuetext={`${occupancy} of ${capacity} places taken`}
        style={{
          height: 10,
          background: 'var(--bg)',
          border: '1px solid var(--edge)',
          overflow: 'hidden',
        }}
      >
        <div
          style={{
            width: `${ratio * 100}%`,
            height: '100%',
            background: full ? 'var(--lvl-warning)' : 'var(--fg)',
            transition: 'width var(--dur-base) var(--ease-out)',
          }}
        />
      </div>

      <p
        className="num"
        style={{ marginTop: 'var(--space-xs)', fontSize: 'var(--size-caption)', color: 'var(--fg-muted)' }}
      >
        {occupancy} of {capacity} places taken
      </p>
    </div>
  );
}
