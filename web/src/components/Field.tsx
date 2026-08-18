/**
 * Text and photo inputs.
 *
 * Every field is labelled and every label is visible — a placeholder that vanishes when
 * you type is not a label, and someone filling this in has just had a flood.
 */
import type { ChangeEvent, ReactNode } from 'react';

export function TextField({
  id,
  label,
  hint,
  value,
  onChange,
  rows = 1,
  placeholder,
}: {
  id: string;
  label: string;
  hint?: string;
  value: string;
  onChange: (value: string) => void;
  /** More than one turns this into a textarea. */
  rows?: number;
  placeholder?: string;
}) {
  const shared = {
    id,
    value,
    placeholder,
    className: 'ng-input',
    onChange: (event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => onChange(event.target.value),
  };

  return (
    <div>
      <label htmlFor={id} className="ng-label">
        {label}
      </label>
      {hint && (
        <p style={{ marginTop: 2, fontSize: 'var(--size-caption)', color: 'var(--fg-muted)' }}>{hint}</p>
      )}
      {rows > 1 ? (
        <textarea {...shared} rows={rows} style={{ resize: 'vertical' }} />
      ) : (
        <input {...shared} type="text" />
      )}
    </div>
  );
}

/**
 * A photo picker.
 *
 * The native file input is hidden behind a label styled as a control, because the browser
 * default ("Choose file — no file chosen") is the one piece of chrome on the screen we
 * cannot restyle and cannot translate.
 */
export function FileField({
  id,
  label,
  hint,
  files,
  onFiles,
  children,
}: {
  id: string;
  label: string;
  hint?: string;
  files: File[];
  onFiles: (files: File[]) => void;
  /** Preview area, when something has been chosen. */
  children?: ReactNode;
}) {
  return (
    <div>
      <span className="ng-label">{label}</span>
      {hint && (
        <p style={{ marginTop: 2, fontSize: 'var(--size-caption)', color: 'var(--fg-muted)' }}>{hint}</p>
      )}

      <div style={{ marginTop: 'var(--space-sm)' }}>
        <input
          id={id}
          type="file"
          accept="image/*"
          multiple
          className="sr-only"
          onChange={(event) => onFiles(Array.from(event.target.files ?? []))}
        />
        <label htmlFor={id} className="ng-button display" data-variant="quiet" style={QUIET}>
          {files.length > 0 ? `${files.length} photo${files.length > 1 ? 's' : ''} chosen` : 'Add photos'}
        </label>
      </div>

      {children}
    </div>
  );
}

/** Matches Button's quiet variant. A <label> cannot be a <button>, so the style is shared. */
const QUIET: React.CSSProperties = {
  background: 'transparent',
  color: 'var(--fg)',
  border: '1px solid var(--edge)',
  minHeight: 'var(--tap-min)',
  fontSize: 'var(--size-body)',
  cursor: 'pointer',
};
