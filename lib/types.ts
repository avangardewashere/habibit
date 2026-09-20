/**
 * Habibit core data model — schema version 2.
 *
 * Normalized so it maps 1:1 onto database tables. Version 2 adds the two things
 * syncing between devices needs and version 1 never recorded:
 *
 * - **When** each record last changed (`updatedAt`), so two devices that edited
 *   the same thing can agree on which edit is newer.
 * - **What was deleted** (`deletedAt`). A record that simply vanishes cannot tell
 *   another device it is gone, so deletes leave a tombstone instead. Selectors
 *   hide tombstones; nothing in the UI ever sees them.
 *
 * The v1 → v2 upgrade lives in `lib/storage.ts`.
 */

/** A habit recurs. It is never "done" — it is done *on a given day*. */
export type Habit = {
  id: string;
  title: string;
  /** ISO instant. */
  createdAt: string;
  /** ISO instant of the last change to this row. Set on every write. */
  updatedAt: string;
  /** Hides a habit while keeping its history. Archive and Unarchive are in its `⋯` menu. */
  archivedAt: string | null;
  /**
   * Where the habit sits in your list: a sort key from `lib/order.ts`, compared
   * as plain text. `null` for habits from before v3 or from an older build,
   * which keep their oldest-first order after every positioned habit until the
   * first time you rearrange.
   *
   * Added without a new storage version on purpose: an older build reading data
   * with this field simply ignores it (see `lib/storage.ts`).
   */
  position: string | null;
  /** Tombstone. Set by deleting; the row is kept so the delete can sync. */
  deletedAt: string | null;
};

/** A task is one-and-done. Checking it is permanent. */
export type Task = {
  id: string;
  title: string;
  /** ISO instant. */
  createdAt: string;
  /** ISO instant of the last change to this row. Set on every write. */
  updatedAt: string;
  /** ISO instant, or null while the task is still open. */
  completedAt: string | null;
  /** Tombstone. Set by deleting; the row is kept so the delete can sync. */
  deletedAt: string | null;
};

/**
 * `YYYY-MM-DD` in the **user's local timezone**, never UTC.
 * Always build these with `dateKey()` from `lib/date.ts` — see the warning there.
 */
export type DateKey = string;

/** `${habitId}::${dateKey}` — one key per (habit, day) pair. */
export type CompletionKey = `${string}::${string}`;

/**
 * Whether a habit was kept on one day.
 *
 * Unticking sets `done: false` rather than removing the record. In v1 an untick
 * erased the row, which is fine on one device but impossible to sync: the other
 * device would still have its tick and no way to learn it was taken back.
 */
export type Completion = {
  done: boolean;
  /** ISO instant of the last tick or untick. */
  updatedAt: string;
};

export type HabibitState = {
  habits: Habit[];
  tasks: Task[];
  /**
   * One row per (habit, day) in a future `completions` table with a unique index
   * on (user_id, habit_id, date). Keyed as a Record so "is this checked today?"
   * is O(1) during render.
   */
  completions: Record<CompletionKey, Completion>;
};
