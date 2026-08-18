/**
 * The quiet label that names a secondary block.
 *
 * Deliberately small and stamped: on a screen with one dominant idea, a section heading's
 * job is to be findable when looked for, not to compete for attention.
 */
export function SectionHeading({ children }: { children: React.ReactNode }) {
  return <h2 className="ng-section-heading">{children}</h2>;
}
