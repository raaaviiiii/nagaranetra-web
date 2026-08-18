/**
 * A number with its label. The label is small and quiet; the number is not.
 *
 * Numbers are tabular so a changing digit does not shift the ones beside it, and a value
 * that is not a number ("Not reached") drops out of the number face — mono at this size
 * wraps and reads as a broken measurement.
 */
export function Stat({ label, value, tone }: { label: string; value: string; tone?: 'warning' }) {
  const numeric = /\d/.test(value);
  return (
    <div>
      <div className="ng-label">{label}</div>
      <div
        className={numeric ? 'num' : undefined}
        style={{
          fontSize: numeric ? 'var(--size-num-lead)' : 'var(--size-lead)',
          fontWeight: 500,
          marginTop: 'var(--space-xs)',
          color: tone === 'warning' ? 'var(--lvl-warning)' : 'var(--fg)',
          lineHeight: 1.1,
        }}
      >
        {value}
      </div>
    </div>
  );
}
