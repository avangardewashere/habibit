import { addDaysToKey } from '@/lib/date';
import { completionKey } from '@/lib/keys';
import type { DateKey, Habit, HabibitState, Task } from '@/lib/types';

/** Habits that are not archived, oldest first. */
export function activeHabits(state: HabibitState): Habit[] {
  return state.habits.filter((h) => h.archivedAt === null);
}

export function isCompleted(state: HabibitState, habitId: string, date: DateKey): boolean {
  return Boolean(state.completions[completionKey(habitId, date)]);
}

/** How many active habits are checked on `date` — the "2/3" in the section header. */
export function completedCount(state: HabibitState, date: DateKey): number {
  return activeHabits(state).filter((h) => isCompleted(state, h.id, date)).length;
}

export function openTasks(state: HabibitState): Task[] {
  return state.tasks.filter((t) => t.completedAt === null);
}

export function doneTasks(state: HabibitState): Task[] {
  return state.tasks.filter((t) => t.completedAt !== null);
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
