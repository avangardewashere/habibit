import type { CompletionKey, DateKey } from './types';

/** Builds the single canonical key for a (habit, day) completion. */
export function completionKey(habitId: string, date: DateKey): CompletionKey {
  return `${habitId}::${date}`;
}
