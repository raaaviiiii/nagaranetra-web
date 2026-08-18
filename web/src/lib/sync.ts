/**
 * Replaying the outbound queue.
 *
 * A help request tapped with no signal must not be lost, and must not pretend to have
 * been sent. It is written to IndexedDB first, the interface says "queued", and it is
 * replayed when the device comes back.
 *
 * Wording rule (CLAUDE.md §2): a delivered item means the request was NOTIFIED to an
 * authority. We never say it dispatched anyone.
 */
import { postRequest } from './api';
import { dequeue, enqueue, listQueued, markAttempted, type QueuedRequest } from './storage';
import type { HelpRequest } from './contract';

/** Queue a help request for delivery. Returns the stored record, including its clientId. */
export async function queueHelpRequest(body: HelpRequest): Promise<QueuedRequest> {
  return enqueue({ clientId: body.clientId, path: '/requests', body });
}

export type FlushResult = { sent: number; remaining: number };

/**
 * Try to deliver everything queued, oldest first.
 *
 * Safe to call at any time: `clientId` makes the endpoint idempotent (contract §6), so a
 * request that actually reached the backend before we lost the response is not duplicated
 * by a retry. Items that fail stay queued with their attempt count incremented.
 */
export async function flush(): Promise<FlushResult> {
  const pending = await listQueued();
  let sent = 0;

  for (const item of pending) {
    try {
      await postRequest(item.body);
      await dequeue(item.clientId);
      sent += 1;
    } catch (error) {
      console.warn('[sync] delivery failed, item stays queued:', item.clientId, error);
      await markAttempted(item.clientId);
    }
  }

  return { sent, remaining: (await listQueued()).length };
}

/**
 * Flush whenever the device regains connectivity. Call once at start-up; returns a
 * teardown function.
 */
export function watchConnectivity(onFlush?: (result: FlushResult) => void): () => void {
  const handler = () => {
    void flush().then((result) => onFlush?.(result));
  };
  window.addEventListener('online', handler);
  return () => window.removeEventListener('online', handler);
}
