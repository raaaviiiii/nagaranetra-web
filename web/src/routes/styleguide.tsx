/**
 * The design system, rendered (CLAUDE.md §4). This page is the check that tokens.css and
 * the fonts are actually wired up — if a face fails to load or a token is misspelled, it
 * shows here first.
 */
const LADDER = [
  { name: 'None', token: '--level-none' },
  { name: 'Watch', token: '--level-watch' },
  { name: 'Alert', token: '--level-alert' },
  { name: 'Warning', token: '--level-warning' },
];

export default function Styleguide() {
  return (
    <section className="mx-auto w-full max-w-[46rem] px-5 py-8">
      <p className="display mb-2 text-[11px] tracking-[0.14em]" style={{ color: 'var(--fg-muted)' }}>
        Design system
      </p>
      <h1 className="display mb-8 text-[clamp(2rem,9vw,3.25rem)] leading-[0.95]" style={{ fontWeight: 800 }}>
        Styleguide
      </h1>

      <h2 className="display mb-3 text-sm tracking-[0.12em]">Warning ladder</h2>
      <div className="mb-8 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {LADDER.map((level) => (
          <div key={level.token} className="border" style={{ borderColor: 'var(--hairline)' }}>
            <div className="h-14" style={{ background: `var(${level.token})` }} />
            <div className="px-2 py-1.5">
              <div className="display text-xs">{level.name}</div>
              <div className="num text-[11px]" style={{ color: 'var(--fg-muted)' }}>
                var({level.token})
              </div>
            </div>
          </div>
        ))}
      </div>

      <h2 className="display mb-3 text-sm tracking-[0.12em]">Type</h2>
      <div className="mb-8 space-y-3 border p-4" style={{ borderColor: 'var(--hairline)' }}>
        <p className="display text-4xl" style={{ fontWeight: 800 }}>
          Archivo — WARNING
        </p>
        <p className="text-base">Inter — water is expected to reach your door by 14:20.</p>
        <p className="font-mal text-base" lang="ml">
          നിങ്ങളുടെ വീട്ടിൽ വെള്ളം കയറാൻ സാധ്യതയുണ്ട്.
        </p>
        <p className="num text-base">IBM Plex Mono — 0123456789 · 62 cm · 14:20</p>
      </div>

      <h2 className="display mb-3 text-sm tracking-[0.12em]">Action</h2>
      <p className="mb-3 text-sm" style={{ color: 'var(--fg-muted)' }}>
        Everything the system predicts uses the ladder. Everything a person does uses this blue.
      </p>
      <button
        type="button"
        className="display px-4 text-sm"
        style={{
          background: 'var(--action)',
          color: 'var(--paper-raised)',
          minHeight: 'var(--tap-min)',
        }}
      >
        Get help
      </button>
    </section>
  );
}
