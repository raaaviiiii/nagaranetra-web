/**
 * The city surface — dark, dense, instrumented. A different product from the citizen
 * screens, on purpose (CLAUDE.md §5). `data-surface="city"` rebinds the tokens for this
 * subtree; no component below it knows which surface it is on.
 */
export default function City() {
  return (
    <div
      data-surface="city"
      className="flex-1"
      style={{ background: 'var(--bg)', color: 'var(--fg)' }}
    >
      <section className="mx-auto w-full max-w-[80rem] px-5 py-8">
        <p className="display mb-2 text-[11px] tracking-[0.14em]" style={{ color: 'var(--fg-muted)' }}>
          Ward view
        </p>
        <h1 className="display mb-5 text-[clamp(1.75rem,5vw,2.5rem)] leading-[0.95]" style={{ fontWeight: 800 }}>
          City dashboard
        </h1>
        <p className="max-w-[38rem] leading-relaxed" style={{ color: 'var(--fg-muted)' }}>
          Households by threshold crossed, open help requests, shelter capacity. Placeholder — built
          after the citizen thread is complete end to end.
        </p>
      </section>
    </div>
  );
}
