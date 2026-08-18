/**
 * The page shell every product screen sits in.
 *
 * WHY THIS EXISTS. The product screens were narrow centred columns — a headline and a
 * paragraph floating in margin — while /styleguide had real authority: a stamped label, a
 * heavy rule under the title, and content that fills the frame. The sheet had already
 * solved the problem and the product had not inherited it. This is that solution, made
 * into a component so a screen cannot forget it.
 *
 * Content runs to 72rem, not 38 — wide enough that a desktop screen holds structure
 * instead of one column of text with a field of white on either side.
 */
import type { ReactNode } from 'react';

export function Page({ children }: { children: ReactNode }) {
  return (
    <div
      className="mx-auto w-full max-w-[72rem]"
      style={{ padding: 'var(--space-xl) var(--gutter) var(--space-2xl)' }}
    >
      {children}
    </div>
  );
}

/**
 * The masthead, in the specimen sheet's voice: what this screen is, what it is called,
 * a rule, and one line of orientation.
 */
export function PageHeader({
  label,
  title,
  lead,
  aside,
}: {
  label: string;
  title: string;
  lead?: string;
  /** Right-aligned facts — counts, distances, a status. Keeps the header from being
   *  a headline alone on an empty band. */
  aside?: ReactNode;
}) {
  return (
    <header style={{ marginBottom: 'var(--space-xl)' }}>
      <div className="flex flex-wrap items-end justify-between" style={{ gap: 'var(--space-md)' }}>
        <div>
          <span className="ng-label">{label}</span>
          <h1
            style={{
              marginTop: 'var(--space-xs)',
              fontSize: 'var(--size-hero)',
              lineHeight: 1.02,
              letterSpacing: '-0.03em',
              fontWeight: 600,
              textWrap: 'balance',
            }}
          >
            {title}
          </h1>
        </div>
        {aside && <div className="flex flex-wrap" style={{ gap: 'var(--space-lg)' }}>{aside}</div>}
      </div>

      {/* The heavy rule is the sheet's, and it is what makes a title read as a masthead
          rather than as a floating headline. */}
      <hr className="sheet-rule" style={{ marginTop: 'var(--space-md)', borderTopWidth: 2 }} />

      {lead && (
        <p
          className="max-w-[54ch]"
          style={{
            marginTop: 'var(--space-md)',
            fontSize: 'var(--size-body)',
            lineHeight: 1.55,
            color: 'var(--fg-muted)',
          }}
        >
          {lead}
        </p>
      )}
    </header>
  );
}
