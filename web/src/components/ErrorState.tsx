/**
 * The error state.
 *
 * Errors do not apologise and they are never vague. Three things, always, in this order:
 * what happened, what it means for you, and the one thing that fixes it. If we do not
 * know how to fix it, we say what we are doing about it instead — never "try again later".
 *
 * The chip is the only chromatic element, and it uses the warning rung because a failure
 * in this product is a safety condition, not a toast.
 */
import { Button } from './Button';

export function ErrorState({
  heading,
  whatHappened,
  howToFix,
  actionLabel,
  onAction,
}: {
  heading: string;
  whatHappened: string;
  howToFix: string;
  actionLabel?: string;
  onAction?: () => void;
}) {
  return (
    <div
      role="alert"
      className="w-full px-5 py-6"
      style={{
        border: '1px solid var(--edge)',
        borderRadius: 'var(--radius-md)',
        background: 'var(--bg-raised)',
      }}
    >
      <span
        className="display inline-flex items-center tracking-[0.12em]"
        style={{
          background: 'var(--lvl-warning)',
          color: 'var(--on-warning)',
          fontSize: 'var(--size-micro)',
          fontWeight: 700,
          padding: '0.28em 0.55em',
          borderRadius: 'var(--radius-sm)',
        }}
      >
        Not working
      </span>

      <h2
        className="display mt-3 text-[length:var(--size-lead)] tracking-[0.02em]"
        style={{ fontWeight: 700 }}
      >
        {heading}
      </h2>

      <p className="mt-2 max-w-[46ch] text-[length:var(--size-caption)] leading-relaxed">
        {whatHappened}
      </p>
      <p
        className="mt-2 max-w-[46ch] text-[length:var(--size-caption)] leading-relaxed"
        style={{ color: 'var(--fg-muted)' }}
      >
        {howToFix}
      </p>

      {actionLabel && (
        <div className="mt-4">
          <Button variant="quiet" onClick={onAction}>
            {actionLabel}
          </Button>
        </div>
      )}
    </div>
  );
}
