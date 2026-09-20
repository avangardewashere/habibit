import { addDaysToKey } from '@/lib/date';
import { completionKey } from '@/lib/keys';
import type { DateKey, Habit, HabibitState, Task } from '@/lib/types';

/*
 * Every selector that lists records hides tombstones. The reducer keeps deleted
 * rows only so the delete can sync; to the UI they do not exist.
 */

/**
 * The order habits are shown in, identical on every device.
 *
 * By `position` (compared as plain text, see lib/order.ts), then habits with no
 * position yet, oldest first — which is exactly the order before v3, so nobody's
 * list moves on the day this ships. Id breaks any remaining tie: two devices can
 * make the same key when both insert between the same two habits at once.
 */
export function compareHabits(a: Habit, b: Habit): number {
  if (a.position !== b.position) {
    if (a.position === null) return 1;
    if (b.position === null) return -1;
    return a.position < b.position ? -1 : 1;
  }
  return Date.parse(a.createdAt) - Date.parse(b.createdAt) || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0);
}

/** Every habit that isn't deleted, archived ones included, in display order. */
export function liveHabits(state: HabibitState): Habit[] {
  return state.habits.filter((h) => h.deletedAt === null).sort(compareHabits);
}

/** Habits that are neither deleted nor archived, in display order. */
export function activeHabits(state: HabibitState): Habit[] {
  return liveHabits(state).filter((h) => h.archivedAt === null);
}

/** Archived habits, in the same order they had in the list. */
export function archivedHabits(state: HabibitState): Habit[] {
  return liveHabits(state).filter((h) => h.archivedAt !== null);
}

/** Tasks that have not been deleted, in the order they were added. */
export function liveTasks(state: HabibitState): Task[] {
  return state.tasks.filter((t) => t.deletedAt === null);
}

/** An untick is stored as `done: false`, so a record merely existing is not enough. */
export function isCompleted(state: HabibitState, habitId: string, date: DateKey): boolean {
  return state.completions[completionKey(habitId, date)]?.done === true;
}

/** How many active habits are checked on `date` — the "2/3" in the section header. */
export function completedCount(state: HabibitState, date: DateKey): number {
  return activeHabits(state).filter((h) => isCompleted(state, h.id, date)).length;
}

export function openTasks(state: HabibitState): Task[] {
  return liveTasks(state).filter((t) => t.completedAt === null);
}

export function doneTasks(state: HabibitState): Task[] {
  return liveTasks(state).filter((t) => t.completedAt !== null);
}

/** Open tasks first, completed ones sunk to the bottom. */
export function sortedTasks(state: HabibitState): Task[] {
  return [...openTasks(state), ...doneTasks(state)];
}

/** The `count` days ending at `today`, oldest first — the 7-day strip's columns. */
export function recentDays(today: DateKey, count = 7): DateKey[] {
  const days: DateKey[] = [];
  for (let offset = count - 1; offset >= 0; offset -= 1) {
    days.push(addDaysToKey(today, -offset));
  }
  return days;
}

/**
 * How many days in a row this habit has been kept, counting back from today.
 *
 * An unfinished *today* does not break the streak: if today is not done yet the
 * count starts from yesterday. A streak therefore stays alive all day and only
 * reaches zero once a whole day has actually been missed — rather than reading 0
 * every morning until you tick something.
 *
 * Walks back until the first gap, so it costs one map lookup per day of streak.
 * Completions dated in the future are ignored, because the walk never starts
 * later than today.
 */
export function currentStreak(state: HabibitState, habitId: string, today: DateKey): number {
  let cursor = isCompleted(state, habitId, today) ? today : addDaysToKey(today, -1);
  let streak = 0;

  while (isCompleted(state, habitId, cursor)) {
    streak += 1;
    cursor = addDaysToKey(cursor, -1);
  }

  return streak;
}
