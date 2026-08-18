/**
 * One question, one screen.
 *
 * THE ONE IDEA IS THE QUESTION. It is set at --size-hero and given the room to be the only
 * thing you see; the progress, the reason and the skip all step back to the smallest sizes
 * in the system. An earlier version set the question at roughly the same weight as the
 * text around it, which made a registration flow read like a form — several things asking
 * for attention at once, none of them clearly first.
 *
 * Every control here comes from the design system. Nothing is styled from scratch.
 */
import { useEffect, useRef, type ReactNode } from 'react';
import { Button } from '../Button';

export function StepShell({
  index,
  total,
  question,
  why,
  assumption,
  onSkip,
  onBack,
  children,
  footer,
}: {
  /** Zero-based. */
  index: number;
  total: number;
  question: string;
  /** Why this is worth answering, from the resident's side of the screen. */
  why: string;
  /** What we will take as true if this is skipped. */
  assumption: string;
  onSkip: () => void;
  onBack?: () => void;
  children: ReactNode;
  /** Explicit continue, for steps that cannot advance on a single tap. */
  footer?: ReactNode;
}) {
  const heading = useRef<HTMLHeadingElement>(null);

  // Move focus to the new question. Without this a keyboard or screen-reader user is left
  // where the previous step's control used to be, with no idea the screen changed.
  useEffect(() => {
    heading.current?.focus();
  }, [index]);

  return (
    <section
      key={index}
      className="mx-auto w-full max-w-[36rem]"
      style={{ padding: 'var(--space-xl) var(--gutter) var(--space-2xl)' }}
    >
      <div className="flex items-center justify-between gap-4">
        <span className="ng-label">
          Question <span className="num">{index + 1}</span> of <span className="num">{total}</span>
        </span>
        {onBack && (
          <Button variant="text" onClick={onBack}>
            Back
          </Button>
        )}
      </div>

      {/* Answered steps are solid, the current one is outlined, the rest are empty. */}
      <div
        className="flex"
        style={{ marginTop: 'var(--space-sm)', gap: 4 }}
        role="progressbar"
        aria-valuenow={index + 1}
        aria-valuemin={1}
        aria-valuemax={total}
        aria-label={`Question ${index + 1} of ${total}`}
      >
        {Array.from({ length: total }, (_, i) => (
          <span
            key={i}
            style={{
              height: 3,
              flex: 1,
              background: i < index ? 'var(--fg)' : i === index ? 'var(--fg-muted)' : 'var(--hairline)',
            }}
          />
        ))}
      </div>

      <h1
        ref={heading}
        tabIndex={-1}
        style={{
          marginTop: 'var(--space-xl)',
          fontSize: 'var(--size-hero)',
          lineHeight: 1.05,
          letterSpacing: '-0.025em',
          fontWeight: 600,
          outline: 'none',
          textWrap: 'balance',
        }}
      >
        {question}
      </h1>

      <p
        style={{
          marginTop: 'var(--space-md)',
          maxWidth: '32ch',
          fontSize: 'var(--size-body)',
          lineHeight: 1.55,
          color: 'var(--fg-muted)',
        }}
      >
        {why}
      </p>

      <div style={{ marginTop: 'var(--space-xl)' }}>{children}</div>

      <div
        className="flex flex-wrap items-center justify-between"
        style={{ marginTop: 'var(--space-xl)', gap: 'var(--space-md)' }}
      >
        <div>
          <Button variant="text" onClick={onSkip}>
            Skip this question
          </Button>
          {/* The assumption is a statement, not part of the control's label. It was inside
              the button before, which made one element do two jobs. */}
          <p
            style={{
              marginTop: 'var(--space-xs)',
              fontSize: 'var(--size-caption)',
              color: 'var(--fg-muted)',
            }}
          >
            {assumption}
          </p>
        </div>
        {footer}
      </div>
    </section>
  );
}
