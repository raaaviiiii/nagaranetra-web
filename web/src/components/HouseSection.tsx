/**
 * The product's argument, drawn.
 *
 * A section through a house: three floors, a figure on each, and the water at the level
 * the ground floor is in trouble and the third is not. It is the thesis of the whole
 * platform in one image, which is why it is the illustration on the screen that asks
 * someone to register.
 *
 * Achromatic except the water, which carries the hazard level — the same rule as
 * everywhere else. Drawn rather than photographed so it stays crisp offline and costs
 * nothing to ship.
 */
import type { Level } from '../lib/contract';
import { levelTokens } from '../lib/levels';

export function HouseSection({ level = 'alert' }: { level?: Level }) {
  const water = levelTokens(level).fill;

  return (
    <svg
      viewBox="0 0 220 160"
      role="img"
      aria-label="A section through a house. Water covers the ground floor; the upper floors are above it."
      style={{ width: '100%', height: 'auto', display: 'block' }}
    >
      {/* Water first, so the building reads as standing in it. */}
      <rect x="0" y="112" width="220" height="48" fill={water} opacity="0.9" />

      {/* Shell */}
      <g stroke="var(--fg)" fill="none" strokeWidth="2">
        <path d="M34 44 L110 12 L186 44" strokeLinejoin="round" />
        <rect x="46" y="44" width="128" height="98" />
        <line x1="46" y1="78" x2="174" y2="78" />
        <line x1="46" y1="110" x2="174" y2="110" />
      </g>

      {/* Figures, 1.72 m at this scale: one per floor. The ground-floor figure is in it. */}
      <g fill="var(--fg)">
        {[
          { x: 66, y: 96 },
          { x: 66, y: 64 },
        ].map((p) => (
          <g key={p.y}>
            <circle cx={p.x} cy={p.y} r="3.4" />
            <rect x={p.x - 2} y={p.y + 4} width="4" height="10" rx="1.6" />
          </g>
        ))}
      </g>
      <g fill="var(--bg-raised)">
        <circle cx="66" cy="128" r="3.4" />
        <rect x="64" y="132" width="4" height="8" rx="1.6" />
      </g>

      {/* The water line, marked the way the threshold line marks a limit. */}
      <line x1="0" y1="112" x2="220" y2="112" stroke="var(--fg)" strokeWidth="2" />
      <g
        fill="var(--fg)"
        fontFamily="var(--font-num)"
        fontSize="9"
        style={{ letterSpacing: '0.04em' }}
      >
        <text x="182" y="106">60 cm</text>
      </g>
    </svg>
  );
}
