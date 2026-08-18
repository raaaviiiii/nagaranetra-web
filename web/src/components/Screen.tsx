/**
 * The citizen page frame: kicker, display title, content. One column, generous type,
 * because these screens are read outdoors, one-handed, under stress (CLAUDE.md §5).
 */
import type { ReactNode } from 'react';

export function Screen({
  kicker,
  title,
  children,
}: {
  kicker: string;
  title: string;
  children: ReactNode;
}) {
  return (
    <section className="mx-auto w-full max-w-[46rem] px-5 py-8">
      <p
        className="display mb-2 text-[11px] tracking-[0.14em]"
        style={{ color: 'var(--fg-muted)' }}
      >
        {kicker}
      </p>
      <h1
        className="display mb-5 text-[clamp(2rem,9vw,3.25rem)] leading-[0.95]"
        style={{ fontWeight: 800 }}
      >
        {title}
      </h1>
      <div className="max-w-[38rem] text-[1.0625rem] leading-relaxed" style={{ color: 'var(--fg-muted)' }}>
        {children}
      </div>
    </section>
  );
}
