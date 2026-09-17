import type { HabibitState } from '@/lib/types';
import { changesToPush, hasChanges, mergeStates } from './merge';
import type { RemoteStore } from './remote';

export type SyncResult = {
  /** Everything from both sides, as the account now also holds it. */
  merged: HabibitState;
  /** How many records were uploaded. */
  uploaded: number;
};

/**
 * One round of combining this device with the account:
 *
 *   1. read everything the account has
 *   2. merge it with the device's data, record by record, latest change winning
 *   3. upload whatever the account is missing or has an older version of
 *   4. only then hand back the merged result
 *
 * If any step fails, this throws and returns nothing, so the caller changes
 * nothing on the device. A later retry starts again from step 1, and because
 * merging is safe to repeat, a half-finished upload does no harm.
 */
export async function syncOnce(local: HabibitState, remote: RemoteStore): Promise<SyncResult> {
  const remoteState = await remote.pull();
  const merged = mergeStates(local, remoteState);
  const changes = changesToPush(merged, remoteState);

  if (hasChanges(changes)) await remote.push(changes);

  return {
    merged,
    uploaded: changes.habits.length + changes.tasks.length + changes.completions.length,
  };
}
