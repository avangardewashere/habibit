import type { Completion, CompletionKey, Habit, HabibitState, Task } from '@/lib/types';

/*
 * Combining two copies of someone's data: this device's, and their account's.
 *
 * The rule is "latest change wins", decided separately for every habit, task and
 * completion, by `updatedAt`. Nothing is ever dropped for being absent on one
 * side: a record only one copy has is simply kept. That is what makes the first
 * sign-in a merge and never a replace — an empty account cannot wipe a full
 * device, and an empty device cannot wipe a full account.
 *
 * Pure, and safe to repeat: merging the result again with either input changes
 * nothing, and the order of the two arguments does not matter.
 */

type Versioned = { updatedAt: string; deletedAt?: string | null };

/** Which of two versions of the same record to keep. */
function newer<T extends Versioned>(a: T, b: T): T {
  const at = Date.parse(a.updatedAt);
  const bt = Date.parse(b.updatedAt);
  if (at !== bt) return at > bt ? a : b;

  // Same instant. A delete wins over an edit, so a tie can never resurrect a
  // deleted habit. After that, any fixed rule will do, as long as both devices
  // pick the same one: compare the records' contents.
  const aDeleted = Boolean(a.deletedAt);
  const bDeleted = Boolean(b.deletedAt);
  if (aDeleted !== bDeleted) return aDeleted ? a : b;
  return JSON.stringify(a) >= JSON.stringify(b) ? a : b;
}

function mergeById<T extends Versioned & { id: string; createdAt: string }>(local: T[], remote: T[]): T[] {
  const byId = new Map<string, T>();
  for (const record of [...local, ...remote]) {
    const existing = byId.get(record.id);
    byId.set(record.id, existing ? newer(existing, record) : record);
  }
  // Oldest first, like the app has always listed them, and identical on every device.
  return [...byId.values()].sort(
    (x, y) => Date.parse(x.createdAt) - Date.parse(y.createdAt) || (x.id < y.id ? -1 : x.id > y.id ? 1 : 0),
  );
}

export function mergeStates(local: HabibitState, remote: HabibitState): HabibitState {
  const completions: Record<CompletionKey, Completion> = { ...local.completions };
  for (const [key, record] of Object.entries(remote.completions) as [CompletionKey, Completion][]) {
    const existing = completions[key];
    completions[key] = existing ? newer(existing, record) : record;
  }

  return {
    habits: mergeById<Habit>(local.habits, remote.habits),
    tasks: mergeById<Task>(local.tasks, remote.tasks),
    completions,
  };
}

/** Everything in `merged` that the account doesn't have yet, or has an older version of. */
export type Changes = {
  habits: Habit[];
  tasks: Task[];
  completions: [CompletionKey, Completion][];
};

function same(a: unknown, b: unknown): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}

export function changesToPush(merged: HabibitState, remote: HabibitState): Changes {
  const remoteHabits = new Map(remote.habits.map((h) => [h.id, h]));
  const remoteTasks = new Map(remote.tasks.map((t) => [t.id, t]));
  const habitIds = new Set(merged.habits.map((h) => h.id));

  return {
    habits: merged.habits.filter((h) => !same(h, remoteHabits.get(h.id))),
    tasks: merged.tasks.filter((t) => !same(t, remoteTasks.get(t.id))),
    completions: (Object.entries(merged.completions) as [CompletionKey, Completion][]).filter(
      ([key, record]) =>
        // A completion can only be stored against a habit the account will have.
        habitIds.has(key.slice(0, key.lastIndexOf('::'))) && !same(record, remote.completions[key]),
    ),
  };
}

export function hasChanges(changes: Changes): boolean {
  return changes.habits.length + changes.tasks.length + changes.completions.length > 0;
}
