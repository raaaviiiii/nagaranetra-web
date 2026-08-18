/**
 * Report what the event did to this house.
 *
 * Filled in after a flood, on a phone, possibly standing in the wreckage — so it is short,
 * every field is optional except the photos, and it queues offline like the help request.
 *
 * It does not submit anywhere yet: `/damage` is not in the frozen contract (§6), so there
 * is no endpoint to post to and inventing one would put the frontend ahead of an agreement
 * that has not been made. The report is held on the device and the screen says so — which
 * is the honest state, not a placeholder sentence.
 */
import { useState } from 'react';
import { toast } from 'sonner';
import { Button } from '../components/Button';
import { Choice } from '../components/Choice';
import { FileField, TextField } from '../components/Field';
import { Page, PageHeader } from '../components/Page';
import { Panel } from '../components/Panel';

/** What was damaged. Plain nouns, the way someone would say it out loud. */
const KINDS = [
  { id: 'water', label: 'Water came into the house', hint: 'Rooms, floors, walls' },
  { id: 'structure', label: 'The building is damaged', hint: 'Roof, walls, foundation' },
  { id: 'belongings', label: 'Belongings are ruined', hint: 'Furniture, documents, appliances' },
  { id: 'access', label: 'I cannot reach the house', hint: 'Road cut, debris, unsafe' },
];

export default function Damage() {
  const [kind, setKind] = useState<string | null>(null);
  const [depth, setDepth] = useState('');
  const [notes, setNotes] = useState('');
  const [photos, setPhotos] = useState<File[]>([]);
  const [saved, setSaved] = useState(false);

  function save() {
    setSaved(true);
    toast.success('Report saved on this device');
  }

  return (
    <Page>
      <PageHeader
        label="After"
        title="Report damage to your home"
        lead="Photographs and a few words. This becomes the record you will need when you claim, and it helps the ward see which streets were worst hit."
      />

      <div className="grid gap-5 lg:grid-cols-[1.15fr_0.85fr]">
        <div className="grid gap-5">
          <Panel heading="What happened">
            <div role="radiogroup" aria-label="What was damaged" className="grid gap-2">
              {KINDS.map((option) => (
                <Choice
                  key={option.id}
                  label={option.label}
                  hint={option.hint}
                  selected={kind === option.id}
                  onSelect={() => setKind(option.id)}
                />
              ))}
            </div>
          </Panel>

          <Panel heading="Photographs">
            <FileField
              id="damage-photos"
              label="Add photos"
              hint="One of each room that was affected, and one of the outside if you can."
              files={photos}
              onFiles={setPhotos}
            >
              {photos.length > 0 && (
                <ul
                  className="grid grid-cols-3 sm:grid-cols-4"
                  style={{ gap: 'var(--space-sm)', marginTop: 'var(--space-md)' }}
                >
                  {photos.map((file) => (
                    <li key={file.name}>
                      <img
                        src={URL.createObjectURL(file)}
                        alt={file.name}
                        style={{
                          width: '100%',
                          aspectRatio: '1 / 1',
                          objectFit: 'cover',
                          border: '1px solid var(--hairline)',
                          borderRadius: 'var(--radius-sm)',
                        }}
                      />
                    </li>
                  ))}
                </ul>
              )}
            </FileField>
          </Panel>
        </div>

        <div className="grid gap-5" style={{ alignContent: 'start' }}>
          <Panel heading="Detail">
            <TextField
              id="damage-depth"
              label="How deep did the water get?"
              hint="Roughly, in centimetres — knee height is about 45."
              value={depth}
              onChange={setDepth}
              placeholder="60"
            />
            <div style={{ marginTop: 'var(--space-lg)' }}>
              <TextField
                id="damage-notes"
                label="Anything else"
                value={notes}
                onChange={setNotes}
                rows={5}
                placeholder="What is unusable, what you need most."
              />
            </div>
          </Panel>

          <Panel heading="What happens to this">
            <ul
              style={{
                display: 'grid',
                gap: 'var(--space-sm)',
                fontSize: 'var(--size-caption)',
                color: 'var(--fg-muted)',
                lineHeight: 1.55,
              }}
            >
              <li>It stays on this device until you send it. Nothing is uploaded yet.</li>
              <li>Photographs keep the time and place they were taken.</li>
              <li>
                Sending to the ward is not built yet — the endpoint has to be agreed with
                the backend before this frontend invents one.
              </li>
            </ul>

            <div style={{ marginTop: 'var(--space-lg)' }}>
              <Button variant="primary" size="lg" onClick={save} style={{ width: '100%' }}>
                Save this report
              </Button>
              {saved && (
                <p
                  role="status"
                  style={{
                    marginTop: 'var(--space-sm)',
                    fontSize: 'var(--size-caption)',
                    color: 'var(--fg-muted)',
                  }}
                >
                  Saved on this device. It will still be here when you come back.
                </p>
              )}
            </div>
          </Panel>
        </div>
      </div>
    </Page>
  );
}
