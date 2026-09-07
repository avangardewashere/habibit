/**
 * Habibit core data model.
 *
 * This shape is deliberately normalized so it maps 1:1 onto database tables in
 * v2 (accounts + sync). v0 keeps it all in memory, but nothing here needs to
 * change when persistence arrives.
 */

/** A habit recurs. It is never "done" — it is done *on a given day*. */
export type Habit = {
  id: string;
  title: string;
  emoji: string | null;
  /** ISO instant. */
  createdAt: string;
  /**
   * Soft delete. Archiving hides a habit while keeping its completion history
   * for stats. Always null in v0; the selectors already honour it.
   */
  archivedAt: string | null;
};

/** A task is one-and-done. Checking it is permanent. */
export type Task = {
  id: string;
  title: string;
  /** ISO instant. */
  createdAt: string;
  /** ISO instant, or null while the task is still open. */
  completedAt: string | null;
};

/**
 * `YYYY-MM-DD` in the **user's local timezone**, never UTC.
 * Always build these with `dateKey()` from `lib/date.ts` — see the warning there.
 */
export type DateKey = string;

/** `${habitId}::${dateKey}` — one key per (habit, day) pair. */
export type CompletionKey = `${string}::${string}`;

export type HabibitState = {
  habits: Habit[];
  tasks: Task[];
  /**
   * A completion is a fact about a (habit, day) pair — exactly one row in a
   * future `completions` table with a unique index on (user_id, habit_id, date).
   * Keyed as a Record so "is this checked today?" is O(1) during render.
   * The value is the ISO instant it was checked.
   */
  completions: Record<CompletionKey, string>;
};
