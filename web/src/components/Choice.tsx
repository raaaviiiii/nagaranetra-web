/**
 * A single choice in a list of options.
 *
 * Sized for a thumb and for one idea at a time: a tall row, one label, one optional line
 * of clarification, and a mark. Selecting it is usually the whole interaction on the
 * screen, so it is allowed to be large.
 */
export function Choice({
  label,
  hint,
  selected,
  onSelect,
}: {
  label: string;
  hint?: string;
  selected: boolean;
  onSelect: () => void;
}) {
  return (
    <button type="button" className="ng-choice" role="radio" aria-checked={selected} onClick={onSelect}>
      <span className="ng-choice-body">
        <span className="ng-choice-label">{label}</span>
        {hint && <span className="ng-choice-hint">{hint}</span>}
      </span>
      {/* Selection is carried by the border and the label weight as well as the mark, so
          it never depends on one small glyph. */}
      <span aria-hidden="true" className="ng-choice-mark">
        {selected ? '✓' : ''}
      </span>
    </button>
  );
}
