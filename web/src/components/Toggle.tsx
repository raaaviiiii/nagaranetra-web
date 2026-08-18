/** A row that can be on or off, for questions where more than one answer can be true. */
export function Toggle({
  label,
  hint,
  pressed,
  onToggle,
}: {
  label: string;
  hint?: string;
  pressed: boolean;
  onToggle: () => void;
}) {
  return (
    <button type="button" className="ng-choice" aria-pressed={pressed} onClick={onToggle}>
      <span className="ng-choice-body">
        <span className="ng-choice-label">{label}</span>
        {hint && <span className="ng-choice-hint">{hint}</span>}
      </span>
      <span aria-hidden="true" className="ng-checkbox">
        {pressed ? '✓' : ''}
      </span>
    </button>
  );
}
