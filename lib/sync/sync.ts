import type { HabibitAction } from '@/store/reducer';
import type { CompletionKey, HabibitState } from '@/lib/types';
import { changesToPush, hasChanges, mergeStates, type Changes } from './merge';
import type { RemoteStore } from './remote';

export type SyncResult = {
  /** Everything from both sides, as the account now also holds it. */
  merged: HabibitState;
  /** The server time to ask "what changed since?" from next time. */
  cursor: string | null;
  /** Exactly what was uploaded, so the caller can tick those items off its outbox. */
  pushed: Changes;
};

const NOTHING: Changes = { habits: [], tasks: [], completions: [] };

function count(changes: Changes): number {
  return changes.habits.length + changes.tasks.length + changes.completions.length;
}
export { count as changeCount };

/**
 * The full combine, used when the app opens or someone signs in:
 *
 *   1. read everything the account has
 *   2. merge it with the device's data, record by record, latest change winning
 *   3. upload whatever the account is missing or has an older version of
 *   4. only then hand back the merged result
 *
 * If any step fails, this throws and returns nothing, so the caller changes
 * nothing on the device. Because merging is safe to repeat, a half-finished
 * upload does no harm: the next attempt simply finishes it.
 */
export async function syncOnce(local: HabibitState, remote: RemoteStore): Promise<SyncResult> {
  const pulled = await remote.pullSince(null);
  const merged = mergeStates(local, pulled.state);
  const changes = changesToPush(merged, pulled.state);

  if (hasChanges(changes)) await remote.push(changes);

  return { merged, cursor: pulled.cursor, pushed: changes };
}

// ---------------------------------------------------------------------------
// Block E: small, frequent syncs while the app is open.
// ---------------------------------------------------------------------------

/**
 * An outbox entry names a record that changed on this device and hasn't been
 * confirmed by the account yet. Only the name is kept: the record itself is read
 * from the device's current data when it is sent, so it is always the latest.
 */
export type OutboxKey = `habit:${string}` | `task:${string}` | `completion:${CompletionKey}`;

/** Which record an action changed. Every write the app can make is listed. */
export function touchedBy(action: HabibitAction): OutboxKey | null {
  /*
   * Deliberately no `default`. Every action is named here, so a new one that
   * isn't is a **type error**, not a silent gap.
   *
   * That gap is not hypothetical. Reorder, archive and unarchive (v3 Block B)
   * were added to the reducer but not here, so they fell through a `default`
   * that said "not an edit" — and never entered the sync queue. They still
   * reached the account eventually, through the full combine when the app next
   * opened, but not live: archive on a phone left open, and the desktop never
   * heard. Found while adding undo, which would have fallen straight in too.
   */
  switch (action.type) {
    case 'ADD_HABIT':
    case 'REMOVE_HABIT':
    case 'RENAME_HABIT':
    case 'MOVE_HABIT':
    case 'ARCHIVE_HABIT':
    case 'UNARCHIVE_HABIT':
      return `habit:${action.id}`;
    case 'TOGGLE_COMPLETION':
      return `completion:${action.habitId}::${action.dateKey}`;
    case 'ADD_TASK':
    case 'TOGGLE_TASK':
    case 'REMOVE_TASK':
    case 'RENAME_TASK':
      return `task:${action.id}`;
    // Not edits someone made on this device: they arrive from storage, from
    // the account, or empty it on sign-out.
    case 'HYDRATE':
    case 'MERGE_REMOTE':
    case 'CLEAR_DEVICE':
      return null;
    default: {
      // Reaching here means an action type above is missing. `action` is
      // `never` only when every case is handled, so this line won't compile
      // until the new one is added.
      const unhandled: never = action;
      return unhandled;
    }
  }
}

/** The current version of every record named in the outbox. */
export function collectChanges(state: HabibitState, outbox: Iterable<OutboxKey>): Changes {
  const keys = new Set(outbox);
  return {
    habits: state.habits.filter((h) => keys.has(`habit:${h.id}`)),
    tasks: state.tasks.filter((t) => keys.has(`task:${t.id}`)),
    completions: (Object.entries(state.completions) as [CompletionKey, HabibitState['completions'][CompletionKey]][]).filter(
      ([key]) => keys.has(`completion:${key}`),
    ),
  };
}

/** The outbox entries a finished upload covered, given what was actually sent. */
export function outboxKeysFor(changes: Changes): Map<OutboxKey, string> {
  const sent = new Map<OutboxKey, string>();
  for (const h of changes.habits) sent.set(`habit:${h.id}`, h.updatedAt);
  for (const t of changes.tasks) sent.set(`task:${t.id}`, t.updatedAt);
  for (const [key, c] of changes.completions) sent.set(`completion:${key}`, c.updatedAt);
  return sent;
}

/*
 * Rows are stamped with the server's time when written, but a slow write can
 * commit a moment after a faster one that was stamped later. Asking for "changed
 * since cursor minus two minutes" re-reads a little every time, and makes sure
 * such a row isn't skipped. Re-reading is harmless: merging is safe to repeat.
 */
export const CURSOR_OVERLAP_MS = 2 * 60_000;

/**
 * One small sync:
 *
 *   1. upload the records named in the outbox
 *   2. download only what changed on the account since `cursor`
 *   3. merge that into the device's data
 *
 * Anything this device has that the account lacks is always in the outbox (every
 * edit is), so there is nothing else to send. If an outbox were ever lost, the
 * full combine on the next app open still catches it.
 *
 * With no cursor yet (nothing has fully synced), this does the full combine instead.
 * Like the full combine, it throws on any failure and the caller changes nothing.
 */
export async function syncChanges(
  local: HabibitState,
  outbox: Iterable<OutboxKey>,
  cursor: string | null,
  remote: RemoteStore,
): Promise<SyncResult> {
  if (cursor === null) return syncOnce(local, remote);

  const outgoing = collectChanges(local, outbox);
  if (hasChanges(outgoing)) await remote.push(outgoing);

  const since = new Date(Date.parse(cursor) - CURSOR_OVERLAP_MS).toISOString();
  const pulled = await remote.pullSince(since);
  const merged = mergeStates(local, pulled.state);

  return {
    merged,
    // Never move the cursor backwards, and keep it if nothing new arrived.
    cursor: pulled.cursor && Date.parse(pulled.cursor) > Date.parse(cursor) ? pulled.cursor : cursor,
    pushed: hasChanges(outgoing) ? outgoing : NOTHING,
  };
}
