/**
 * The IMD level, as a stamped chip.
 *
 * Heavy condensed uppercase, because a level is a status word and that is the one place
 * CLAUDE.md §5 allows the display face to be heavy. The fill is the ladder colour and the
 * text colour is whichever one is legal on it — see §2 of /styleguide, which computes
 * every one of those ratios in the browser rather than trusting this comment.
 */
import type { Level } from '../lib/contract';
import { LEVEL_WORD, levelTokens } from '../lib/levels';

export function LevelChip({ level, size = 'md' }: { level: Level; size?: 'sm' | 'md' | 'lg' }) {
  const { fill, on } = levelTokens(level);
  const fontSize =
    size === 'lg' ? 'var(--size-lead)' : size === 'sm' ? 'var(--size-micro)' : 'var(--size-caption)';

  return (
    <span
      className="display inline-flex items-center tracking-[0.12em]"
      style={{
        background: fill,
        color: on,
        fontSize,
        fontWeight: 700,
        padding: size === 'lg' ? '0.35em 0.7em' : '0.28em 0.55em',
        borderRadius: 'var(--radius-sm)',
      }}
    >
      {LEVEL_WORD[level]}
    </span>
  );
}
