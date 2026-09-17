import type { Completion, CompletionKey, Habit, HabibitState, Task } from '@/lib/types';

/*
 * The app and the database describe the same data in two shapes:
 * camelCase ISO strings in the app, snake_case timestamptz columns in Postgres,
 * and one `habitId::day` key where the database has two columns.
 *
 * Postgres also writes times its own way ("2026-09-17 08:05:00+00") and to the
 * microsecond. Every time read back is normalised to the app's exact ISO form,
 * so a record that round-trips unchanged compares as unchanged — otherwise every
 * sync would think everything had been edited and upload it all again.
 */

export type HabitRow = {
  id: string;
  title: string;
  created_at: string;
  updated_at: string;
  archived_at: string | null;
  deleted_at: string | null;
};

export type TaskRow = {
  id: string;
  title: string;
  created_at: string;
  updated_at: string;
  completed_at: string | null;
  deleted_at: string | null;
};

export type CompletionRow = {
  habit_id: string;
  day: string;
  done: boolean;
  updated_at: string;
};

const iso = (value: string) => new Date(value).toISOString();
const isoOrNull = (value: string | null) => (value === null ? null : iso(value));

export const habitToRow = (h: Habit): HabitRow => ({
  id: h.id,
  title: h.title,
  created_at: h.createdAt,
  updated_at: h.updatedAt,
  archived_at: h.archivedAt,
  deleted_at: h.deletedAt,
});

export const rowToHabit = (r: HabitRow): Habit => ({
  id: r.id,
  title: r.title,
  createdAt: iso(r.created_at),
  updatedAt: iso(r.updated_at),
  archivedAt: isoOrNull(r.archived_at),
  deletedAt: isoOrNull(r.deleted_at),
});

export const taskToRow = (t: Task): TaskRow => ({
  id: t.id,
  title: t.title,
  created_at: t.createdAt,
  updated_at: t.updatedAt,
  completed_at: t.completedAt,
  deleted_at: t.deletedAt,
});

export const rowToTask = (r: TaskRow): Task => ({
  id: r.id,
  title: r.title,
  createdAt: iso(r.created_at),
  updatedAt: iso(r.updated_at),
  completedAt: isoOrNull(r.completed_at),
  deletedAt: isoOrNull(r.deleted_at),
});

export function completionToRow(key: CompletionKey, c: Completion): CompletionRow {
  // Habit ids are UUIDs and never contain "::", so the last one splits id from day.
  const split = key.lastIndexOf('::');
  return { habit_id: key.slice(0, split), day: key.slice(split + 2), done: c.done, updated_at: c.updatedAt };
}

export function rowToCompletion(r: CompletionRow): [CompletionKey, Completion] {
  return [`${r.habit_id}::${r.day}`, { done: r.done, updatedAt: iso(r.updated_at) }];
}

export function rowsToState(habits: HabitRow[], tasks: TaskRow[], completions: CompletionRow[]): HabibitState {
  return {
    habits: habits.map(rowToHabit),
    tasks: tasks.map(rowToTask),
    completions: Object.fromEntries(completions.map(rowToCompletion)) as HabibitState['completions'],
  };
}
