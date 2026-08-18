/**
 * Nearest hospital, fire station, police station and shelter.
 *
 * Distances are from `/nearby`, measured from this household's pin — the point of the
 * whole product is that these are yours, not your district's.
 *
 * The phone numbers are India's public emergency numbers, and the control says which one
 * it dials. Note the wording: this places a call. We do not dispatch anybody, and nothing
 * on this list may imply we did (CLAUDE.md §2).
 */
import type { NearbyService, ServiceType } from '../lib/contract';

const TYPE_LABEL: Record<ServiceType, string> = {
  hospital: 'Hospital',
  fire: 'Fire',
  police: 'Police',
  shelter: 'Shelter',
};

/** "310 m" under a kilometre, "1.2 km" over it — the way distance is actually spoken. */
function formatDistance(metres: number): string {
  return metres < 1000 ? `${metres} m` : `${(metres / 1000).toFixed(1)} km`;
}

export function NearbyList({ services }: { services: NearbyService[] }) {
  return (
    <section>
      <h2
        className="display mb-3 text-[length:var(--size-micro)] tracking-[0.14em]"
        style={{ color: 'var(--fg-muted)' }}
      >
        Nearest help
      </h2>

      <ul style={{ borderTop: '1px solid var(--hairline)' }}>
        {services.map((service) => (
          <li
            key={`${service.type}-${service.name}`}
            className="flex items-center justify-between gap-3 py-3"
            style={{ borderBottom: '1px solid var(--hairline)' }}
          >
            <div className="min-w-0">
              <div
                className="display text-[length:var(--size-micro)] tracking-[0.12em]"
                style={{ color: 'var(--fg-muted)' }}
              >
                {TYPE_LABEL[service.type]}
              </div>
              <div
                className="text-[length:var(--size-small)] leading-snug"
                style={{ display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}
              >
                {service.name}
              </div>
            </div>

            <div className="flex flex-shrink-0 items-center gap-3">
              <span className="num text-[length:var(--size-caption)]" style={{ color: 'var(--fg-muted)' }}>
                {formatDistance(service.distanceM)}
              </span>
              <a
                href={`tel:${service.phone}`}
                className="ng-button display"
                style={{
                  background: 'transparent',
                  color: 'var(--action)',
                  border: '1px solid var(--edge)',
                  minHeight: 'var(--tap-min)',
                  fontSize: 'var(--size-caption)',
                  textDecoration: 'none',
                }}
                aria-label={`Call ${service.name} on ${service.phone}`}
              >
                Call {service.phone}
              </a>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
