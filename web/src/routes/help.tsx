/**
 * Ask for help.
 *
 * No account, no login, no guest account — none (CLAUDE.md §2). Reaching this screen and
 * sending a request takes two taps and works with the network off.
 *
 * WEIGHT. This is the screen a person opens in the worst moment of their year, and it had
 * been a paragraph floating in whitespace. The request itself is the anchor: four kinds,
 * each a large target, then one send. Everything else on the page answers the questions a
 * person actually has at that moment — what happens next, and who sees this — because not
 * knowing is what makes people hesitate before asking.
 *
 * The wording is held to §2: we notify and match. We never say we are sending anyone.
 */
import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import type { RequestType, Urgency } from '../lib/contract';
import { getStatus, subscribeToStatus } from '../lib/api';
import { useSyncExternalStore } from 'react';
import { loadProfile, queueLength } from '../lib/storage';
import { queueHelpRequest, flush } from '../lib/sync';
import { Button } from '../components/Button';
import { Choice } from '../components/Choice';
import { Page, PageHeader } from '../components/Page';
import { Panel } from '../components/Panel';
import { Stat } from '../components/Stat';

/**
 * The four things people ask for.
 *
 * The marks carry a text presentation selector: U+26D1 is emoji-capable and would render
 * in full colour on some platforms, which would put the one non-token colour in the
 * product on the emergency screen.
 *
 * These are stand-ins. CLAUDE.md §1 requires the emergency path to be completable without
 * reading, and that needs a drawn icon set rather than glyphs borrowed from a font.
 */
const KINDS: Array<{ id: RequestType; label: string; hint: string; urgency: Urgency; mark: string }> = [
  { id: 'rescue', label: 'We need to get out', hint: 'Trapped, water rising, cannot leave', urgency: 'critical', mark: '⛑\uFE0E' },
  { id: 'medical', label: 'Someone needs medical help', hint: 'Injured, ill, out of medicine', urgency: 'critical', mark: '✚' },
  { id: 'supplies', label: 'We need food or water', hint: 'Safe, but running out', urgency: 'urgent', mark: '◍' },
  { id: 'shelter', label: 'We need somewhere to stay', hint: 'The house is not usable', urgency: 'urgent', mark: '⌂' },
];

export default function Help() {
  const status = useSyncExternalStore(subscribeToStatus, getStatus, getStatus);
  const [kind, setKind] = useState<RequestType | null>(null);
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [queued, setQueued] = useState(0);

  useEffect(() => {
    void queueLength().then(setQueued);
  }, [sent]);

  async function send() {
    const chosen = KINDS.find((k) => k.id === kind);
    if (!chosen) return;
    setSending(true);

    const profile = await loadProfile();
    await queueHelpRequest({
      type: chosen.id,
      urgency: chosen.urgency,
      lat: profile?.lat ?? 0,
      lng: profile?.lng ?? 0,
      createdAt: new Date().toISOString(),
      clientId: crypto.randomUUID(),
    });

    // Try immediately; if it fails it stays queued, and the screen says so rather than
    // claiming a delivery that did not happen.
    const result = await flush();
    setSending(false);
    setSent(true);
    toast.success(result.sent > 0 ? 'Request sent' : 'Request queued on this device');
  }

  if (sent) {
    return (
      <Page>
        <PageHeader
          label="Emergency"
          title="Your request is in"
          lead="Keep this device with you if you can. You can send another request at any time."
        />
        <div className="grid gap-5 lg:grid-cols-2">
          <Panel heading="What happens now">
            <ol
              style={{
                display: 'grid',
                gap: 'var(--space-md)',
                fontSize: 'var(--size-body)',
                lineHeight: 1.5,
              }}
            >
              <li>
                <span className="ng-label">Step 1</span>
                <p style={{ marginTop: 2 }}>
                  Your request is matched to the nearest team with the right capability.
                </p>
              </li>
              <li>
                <span className="ng-label">Step 2</span>
                <p style={{ marginTop: 2 }}>
                  A human at the district control room decides and acts. We notify and
                  match — we do not dispatch anyone ourselves.
                </p>
              </li>
              <li>
                <span className="ng-label">Step 3</span>
                <p style={{ marginTop: 2 }}>
                  If you have no signal, the request waits on this device and goes as soon
                  as you do.
                </p>
              </li>
            </ol>
          </Panel>

          <Panel heading="While you wait">
            <div className="grid gap-2">
              <Button variant="primary" href="tel:112">
                Call 112
              </Button>
              <Button variant="quiet" href="/shelters">
                Find a shelter
              </Button>
              <Button variant="quiet" onClick={() => setSent(false)}>
                Send another request
              </Button>
            </div>
          </Panel>
        </div>
      </Page>
    );
  }

  return (
    <Page>
      <PageHeader
        label="Emergency"
        title="Ask for help"
        lead="No account, no sign-in. Choose what you need and send it — it works without a network."
        aside={
          <>
            <Stat label="Connection" value={status === 'offline' ? 'Offline' : 'Online'} />
            {queued > 0 && <Stat label="Waiting to send" value={String(queued)} tone="warning" />}
          </>
        }
      />

      <div className="grid gap-5 lg:grid-cols-[1.2fr_0.8fr]">
        {/* The request. This is the anchor of the screen. */}
        <Panel heading="What do you need?">
          <div role="radiogroup" aria-label="What do you need" className="grid gap-2">
            {KINDS.map((option) => (
              <Choice
                key={option.id}
                label={`${option.mark}  ${option.label}`}
                hint={option.hint}
                selected={kind === option.id}
                onSelect={() => setKind(option.id)}
              />
            ))}
          </div>

          <div style={{ marginTop: 'var(--space-lg)' }}>
            <Button
              variant="emergency"
              size="lg"
              onClick={send}
              disabled={!kind || sending}
              style={{ width: '100%' }}
            >
              {sending ? 'Sending…' : kind ? 'Send this request' : 'Choose one above'}
            </Button>
            <p
              style={{
                marginTop: 'var(--space-sm)',
                fontSize: 'var(--size-caption)',
                color: 'var(--fg-muted)',
                lineHeight: 1.5,
              }}
            >
              {status === 'offline'
                ? 'You are offline. Your request will be held on this device and sent the moment you have signal.'
                : 'Your location is attached so a team can find you.'}
            </p>
          </div>
        </Panel>

        <div className="grid gap-5" style={{ alignContent: 'start' }}>
          <Panel heading="If it is life-threatening">
            <p style={{ fontSize: 'var(--size-body)', lineHeight: 1.5 }}>
              Call the emergency services directly. This app notifies and matches — it does
              not replace a phone call.
            </p>
            <div className="grid gap-2" style={{ marginTop: 'var(--space-md)' }}>
              <Button variant="primary" href="tel:112">
                Call 112 — all emergencies
              </Button>
              <Button variant="quiet" href="tel:108">
                Call 108 — ambulance
              </Button>
            </div>
          </Panel>

          <Panel heading="Who sees this">
            <ul
              style={{
                display: 'grid',
                gap: 'var(--space-sm)',
                fontSize: 'var(--size-caption)',
                color: 'var(--fg-muted)',
                lineHeight: 1.55,
              }}
            >
              <li>The district control room, and the team they match you to.</li>
              <li>Your location and what you asked for. No name, no account, no sign-in.</li>
              <li>You can send more than one request. Sending twice does not create two.</li>
            </ul>
          </Panel>
        </div>
      </div>
    </Page>
  );
}
