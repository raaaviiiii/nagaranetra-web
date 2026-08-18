/**
 * The empty state.
 *
 * An empty screen is an invitation to act, not an apology. So: a plate where a diagram
 * will go, a heading that says what is missing, one line of body that says why it matters
 * to this person, and exactly one way forward.
 *
 * The plate is a bordered field with a rule through it — the blank box on a form, not a
 * cartoon. Nothing here is chromatic; nothing is wrong yet.
 */
import type { ReactNode } from 'react';
import { Button } from './Button';

export function EmptyState({
  heading,
  body,
  actionLabel,
  onAction,
  illustration,
}: {
  heading: string;
  body: string;
  actionLabel: string;
  onAction?: () => void;
  /** Optional diagram. The reserved plate is deliberate — it holds the space until the
   *  real illustration exists, instead of the layout jumping when it lands. */
  illustration?: ReactNode;
}) {
  return (
    <div
      className="w-full px-5 py-8 text-center"
      style={{ border: '1px solid var(--hairline)', borderRadius: 'var(--radius-md)' }}
    >
      <div
        className="mx-auto mb-5 flex items-center justify-center"
        style={{
          width: '100%',
          maxWidth: 220,
          aspectRatio: '16 / 9',
          border: '1px solid var(--hairline)',
          borderRadius: 'var(--radius-sm)',
        }}
        aria-hidden="true"
      >
        {illustration ?? <div style={{ width: '55%', height: 2, background: 'var(--hairline)' }} />}
      </div>

      <h2 className="display text-[length:var(--size-title)] tracking-[0.02em]" style={{ fontWeight: 700 }}>
        {heading}
      </h2>
      <p
        className="mx-auto mt-2 max-w-[34ch] text-[length:var(--size-small)] leading-relaxed"
        style={{ color: 'var(--fg-muted)' }}
      >
        {body}
      </p>
      <div className="mt-5">
        <Button variant="primary" onClick={onAction}>
          {actionLabel}
        </Button>
      </div>
    </div>
  );
}
