/**
 * Live / Simulated.
 *
 * CLAUDE.md §2: "Label simulated data as simulated, visibly, on the face of the product."
 * This chip is that label. It reads the seam's current source, so it can never disagree
 * with where the numbers actually came from.
 *
 * It is not decorative and it is not chromatic — the achromatic rule holds; colour on
 * this screen belongs to the hazard ladder alone.
 */
import { useSyncExternalStore } from 'react';
import { getSource, subscribeToSource } from '../lib/api';

export function StatusChip() {
  const source = useSyncExternalStore(subscribeToSource, getSource, getSource);
  const live = source === 'live';

  return (
    <span
      className="display inline-flex items-center gap-1.5 border px-2 py-1 text-[11px] tracking-wide"
      style={{ borderColor: 'var(--hairline)', color: 'var(--fg-muted)' }}
      /* Announced politely: it changes mid-session and must not interrupt a task. */
      aria-live="polite"
    >
      <span
        aria-hidden="true"
        className="inline-block h-1.5 w-1.5 rounded-full"
        style={{ background: live ? 'var(--level-none)' : 'var(--fg-muted)' }}
      />
      {live ? 'Live data' : 'Simulated data'}
    </span>
  );
}
