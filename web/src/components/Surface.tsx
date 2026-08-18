/**
 * A panel on one of the two surfaces.
 *
 * The citizen surface and the city surface are different products (CLAUDE.md §5), and the
 * only thing that makes them different is which tokens are bound. Wrapping a subtree in
 * `<Surface kind="city">` repaints everything inside it; nothing inside knows.
 */
import type { ReactNode } from 'react';

export function Surface({
  kind,
  children,
  className = '',
}: {
  kind: 'citizen' | 'city';
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      data-surface={kind === 'city' ? 'city' : undefined}
      className={className}
      style={{ background: 'var(--bg)', color: 'var(--fg)' }}
    >
      {children}
    </div>
  );
}
