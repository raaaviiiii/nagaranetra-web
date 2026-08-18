/**
 * A layered surface with an optional stamped heading.
 *
 * This is the workhorse behind every list and form on the product screens: it is what
 * gives a page structure that is not just typography on paper. Raised against the page,
 * a hairline border, and real padding.
 */
import type { ReactNode } from 'react';

export function Panel({
  heading,
  aside,
  children,
  padded = true,
}: {
  heading?: string;
  /** A value or control that belongs with the heading, on the right. */
  aside?: ReactNode;
  children: ReactNode;
  /** Off for lists that manage their own row padding. */
  padded?: boolean;
}) {
  return (
    <section
      style={{
        background: 'var(--bg-raised)',
        border: '1px solid var(--hairline)',
        borderRadius: 'var(--radius-md)',
        overflow: 'hidden',
      }}
    >
      {heading && (
        <header
          className="flex items-center justify-between"
          style={{
            gap: 'var(--space-md)',
            padding: 'var(--space-md) var(--space-lg)',
            borderBottom: '1px solid var(--hairline)',
          }}
        >
          <span className="ng-label">{heading}</span>
          {aside}
        </header>
      )}
      <div style={{ padding: padded ? 'var(--space-lg)' : 0 }}>{children}</div>
    </section>
  );
}
