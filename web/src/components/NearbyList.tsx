/**
 * Nearest hospital, fire station, police station and shelter.
 *
 * Distances are from `/nearby`, measured from this household's pin — the point of the
 * product is that these are yours, not your district's.
 *
 * WEIGHT. An earlier version gave every row an outlined call button, which put five
 * bordered controls of near-equal weight directly under the one instruction the screen
 * exists to deliver. This is supporting information: the whole row is the link, the phone
 * number is quiet text, and the only strong mark is the action blue on the number itself.
 *
 * The numbers are India's public emergency numbers, and the row says which one it dials.
 * Nothing here implies we dispatch anyone — we do not (CLAUDE.md §2).
 */
import type { NearbyService, ServiceType } from '../lib/contract';
import { SectionHeading } from './SectionHeading';

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

export function NearbyList({
  services,
  heading = 'Nearest help',
}: {
  services: NearbyService[];
  /** Null when a surrounding panel already names this list. */
  heading?: string | null;
}) {
  return (
    <section>
      {heading && <SectionHeading>{heading}</SectionHeading>}

      <ul style={{ marginTop: heading ? 'var(--space-md)' : 0 }}>
        {services.map((service) => (
          <li key={`${service.type}-${service.name}`} style={{ borderTop: '1px solid var(--hairline)' }}>
            <a
              href={`tel:${service.phone}`}
              className="ng-row"
              aria-label={`Call ${service.name}, ${TYPE_LABEL[service.type]}, ${formatDistance(
                service.distanceM,
              )} away, on ${service.phone}`}
            >
              <span className="min-w-0">
                <span className="ng-label">
                  {TYPE_LABEL[service.type]} · <span className="num">{formatDistance(service.distanceM)}</span>
                </span>
                <span
                  style={{
                    display: 'block',
                    marginTop: 2,
                    fontSize: 'var(--size-body)',
                    lineHeight: 1.3,
                  }}
                >
                  {service.name}
                </span>
              </span>
              <span
                className="num"
                style={{ flex: '0 0 auto', color: 'var(--action)', fontSize: 'var(--size-body)' }}
              >
                {service.phone}
              </span>
            </a>
          </li>
        ))}
      </ul>
    </section>
  );
}
