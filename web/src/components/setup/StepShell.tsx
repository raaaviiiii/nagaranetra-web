/**
 * One question, one screen.
 *
 * The frame every setup step sits in: honest progress, the question, why it is being
 * asked, and a way past it. Nothing here is a form field in the government sense — the
 * person is telling us about their home, and the screen should read that way.
 *
 * Progress is honest in three ways: the count is real, the bar shows answered steps
 * separately from the one in progress, and every step states what will be assumed if it
 * is skipped. A progress bar that hides how much is left, or a "required" marker on a
 * question that is not, would both be lies.
 */
import { useEffect, useRef, type ReactNode } from 'react';

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
  /** What we will take as true if this is skipped. Shown on the skip control. */
  assumption: string;
  onSkip: () => void;
  onBack?: () => void;
  children: ReactNode;
  /** Explicit continue, for steps that cannot advance on a single tap. */
  footer?: ReactNode;
}) {
  const heading = useRef<HTMLHeadingElement>(null);

  // Move focus to the new question. Without this, a keyboard or screen-reader user is
  // left where the previous step's control used to be, with no idea the screen changed.
  useEffect(() => {
    heading.current?.focus();
  }, [index]);

  return (
    <section className="ng-step mx-auto w-full max-w-[34rem] px-5 pb-10 pt-6" key={index}>
      <div className="flex items-baseline justify-between gap-3">
        <span
          className="display text-[length:var(--size-micro)] tracking-[0.14em]"
          style={{ color: 'var(--fg-muted)' }}
        >
          Question <span className="num">{index + 1}</span> of <span className="num">{total}</span>
        </span>
        {onBack && (
          <button
            type="button"
            onClick={onBack}
            className="text-[length:var(--size-caption)] underline"
            style={{ color: 'var(--fg-muted)', textUnderlineOffset: '3px', minHeight: 'var(--tap-min)' }}
          >
            Back
          </button>
        )}
      </div>

      {/* Answered steps are solid, the current one is outlined, the rest are empty. */}
      <div
        className="mt-2 flex gap-1"
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
              height: 4,
              flex: 1,
              background: i < index ? 'var(--fg)' : 'transparent',
              border: `1px solid ${i <= index ? 'var(--fg)' : 'var(--hairline)'}`,
            }}
          />
        ))}
      </div>

      <h1
        ref={heading}
        tabIndex={-1}
        className="mt-6 text-[length:var(--size-action)] leading-[1.15]"
        style={{ fontWeight: 600, letterSpacing: '-0.015em', outline: 'none' }}
      >
        {question}
      </h1>
      <p
        className="mt-2 text-[length:var(--size-small)] leading-relaxed"
        style={{ color: 'var(--fg-muted)' }}
      >
        {why}
      </p>

      <div className="mt-6">{children}</div>

      <div className="mt-7 flex flex-wrap items-center justify-between gap-3">
        <button
          type="button"
          onClick={onSkip}
          className="text-left text-[length:var(--size-caption)]"
          style={{ color: 'var(--fg-muted)', minHeight: 'var(--tap-min)' }}
        >
          <span className="underline" style={{ textUnderlineOffset: '3px' }}>
            Skip this
          </span>
          <span className="block" style={{ opacity: 0.85 }}>
            {assumption}
          </span>
        </button>
        {footer}
      </div>
    </section>
  );
}

/** A single-choice row. Selecting it advances — that is what keeps this under a minute. */
export function Choice({
  label,
  hint,
  selected,
  onSelect,
}: {
  label: string;
  hint?: string;
  selected: boolean;
  onSelect: () => void;
}) {
  return (
    <button type="button" className="ng-choice" role="radio" aria-checked={selected} onClick={onSelect}>
      <span>
        <span className="block text-[length:var(--size-body)]" style={{ fontWeight: selected ? 600 : 400 }}>
          {label}
        </span>
        {hint && (
          <span
            className="mt-0.5 block text-[length:var(--size-caption)]"
            style={{ color: 'var(--fg-muted)' }}
          >
            {hint}
          </span>
        )}
      </span>
      {/* The tick is the only confirmation, so it must not be the only cue: the row also
          carries a heavier border and a heavier label when chosen. */}
      <span aria-hidden="true" style={{ color: selected ? 'var(--fg)' : 'transparent', fontWeight: 700 }}>
        ✓
      </span>
    </button>
  );
}

/** A toggle row, for questions where more than one answer can be true at once. */
export function Toggle({
  label,
  hint,
  pressed,
  onToggle,
}: {
  label: string;
  hint?: string;
  pressed: boolean;
  onToggle: () => void;
}) {
  return (
    <button type="button" className="ng-choice" aria-pressed={pressed} onClick={onToggle}>
      <span>
        <span className="block text-[length:var(--size-body)]" style={{ fontWeight: pressed ? 600 : 400 }}>
          {label}
        </span>
        {hint && (
          <span
            className="mt-0.5 block text-[length:var(--size-caption)]"
            style={{ color: 'var(--fg-muted)' }}
          >
            {hint}
          </span>
        )}
      </span>
      <span
        aria-hidden="true"
        style={{
          width: 20,
          height: 20,
          flex: '0 0 auto',
          border: `2px solid ${pressed ? 'var(--fg)' : 'var(--edge)'}`,
          background: pressed ? 'var(--fg)' : 'transparent',
          color: pressed ? 'var(--bg-raised)' : 'transparent',
          borderRadius: 2,
          display: 'grid',
          placeItems: 'center',
          fontSize: 13,
          fontWeight: 700,
          lineHeight: 1,
        }}
      >
        ✓
      </span>
    </button>
  );
}
