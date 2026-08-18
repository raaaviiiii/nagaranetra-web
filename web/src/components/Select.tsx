/** A labelled select. The label is always present — a bare control is a guessing game. */
export function Select({
  id,
  label,
  value,
  onChange,
  children,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label htmlFor={id} className="ng-label">
        {label}
      </label>
      <select id={id} className="ng-select" value={value} onChange={(event) => onChange(event.target.value)}>
        {children}
      </select>
    </div>
  );
}
