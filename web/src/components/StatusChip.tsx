/**
 * Live / Simulated / Offline.
 *
 * CLAUDE.md §2: "Label simulated data as simulated, visibly, on the face of the product",
 * and "failures must be loud". This chip is both rules made visible. It is never hidden,
 * it has no dismiss control, and it cannot be silently wrong: it reads the seam's own
 * status through useSyncExternalStore, so it re-renders the instant a call falls back or
 * the device drops off the network.
 *
 * It is not decorative. The dot uses the hazard ladder's `none` green for live data and
 * stays achromatic otherwise — colour in this product means a hazard level, and a data
 * source is not a hazard.
 */
import { useSyncExternalStore } from 'react';
import { getStatus, subscribeToStatus, type ApiStatus } from '../lib/api';

const COPY: Record<ApiStatus, { label: string; detail: string }> = {
  live: { label: 'Live data', detail: 'Connected to the live service.' },
  simulated: {
    label: 'Simulated data',
    detail: 'Showing committed scenario data, not a live feed.',
  },
  offline: {
    label: 'Offline',
    detail: 'No network. Showing committed scenario data; anything you send is queued.',
  },
};

/**
 * The chip as pure presentation. Exported only so the styleguide can render all three
 * states side by side; product code uses <StatusChip>, which cannot be told what to say.
 */
export function StatusChipView({ status }: { status: ApiStatus }) {
  const { label, detail } = COPY[status];

  return (
    <span
      className="display inline-flex items-center gap-1.5 border px-2 py-1 text-[11px] tracking-wide"
      style={{ borderColor: 'var(--hairline)', color: 'var(--fg-muted)' }}
      /* Polite: it changes mid-session and must not interrupt what someone is doing. */
      aria-live="polite"
      /* The label alone is terse; the accessible name carries the consequence. */
      aria-label={`${label}. ${detail}`}
      title={detail}
      data-status={status}
    >
      <span
        aria-hidden="true"
        className="inline-block h-1.5 w-1.5 rounded-full"
        style={{
          background: status === 'live' ? 'var(--level-none)' : 'var(--fg-muted)',
          // Offline is the one state that should catch the eye without using hazard colour.
          outline: status === 'offline' ? '2px solid var(--fg-muted)' : 'none',
          outlineOffset: '1px',
        }}
      />
      {label}
    </span>
  );
}

/** The live chip. Reads the seam directly, so it cannot disagree with the numbers. */
export function StatusChip() {
  const status = useSyncExternalStore(subscribeToStatus, getStatus, getStatus);
  return <StatusChipView status={status} />;
}
