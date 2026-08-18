/**
 * The empty state.
 *
 * An empty screen is an invitation to act, not an apology: a heading that says what is
 * missing, one line that says why it matters to this person, and exactly one way forward.
 *
 * There is no illustration plate. An earlier version reserved a bordered 16:9 box for a
 * diagram that does not exist yet — on screen that is indistinguishable from a broken
 * image, and it was read as one. A placeholder for nothing is worse than nothing.
 */
import { Button } from './Button';

export function EmptyState({
  heading,
  body,
  actionLabel,
  onAction,
  href,
}: {
  heading: string;
  body: string;
  actionLabel: string;
  onAction?: () => void;
  /** Prefer this when the action navigates: it renders a real link. */
  href?: string;
}) {
  return (
    <div style={{ maxWidth: '30ch' }}>
      <h2
        style={{
          fontSize: 'var(--size-hero)',
          lineHeight: 1.05,
          letterSpacing: '-0.025em',
          fontWeight: 600,
          textWrap: 'balance',
        }}
      >
        {heading}
      </h2>
      <p
        style={{
          marginTop: 'var(--space-md)',
          fontSize: 'var(--size-body)',
          lineHeight: 1.55,
          color: 'var(--fg-muted)',
        }}
      >
        {body}
      </p>
      <div style={{ marginTop: 'var(--space-lg)' }}>
        {href ? (
          <Button variant="primary" size="lg" href={href}>
            {actionLabel}
          </Button>
        ) : (
          <Button variant="primary" size="lg" onClick={onAction}>
            {actionLabel}
          </Button>
        )}
      </div>
    </div>
  );
}
