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
