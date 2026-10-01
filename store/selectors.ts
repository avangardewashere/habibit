import { addDaysToKey, dateKey, mondayIndex } from '@/lib/date';
import { completionKey } from '@/lib/keys';
import { isDueOn, parseSchedule, weekOf, weekStart } from '@/lib/schedule';
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

/**
 * Is this habit meant to be kept on this day? (v4 Block C.)
 *
 * The one place the app asks. `lib/schedule.ts` holds the rule; this hands it
 * the habit's own history, which N-times-a-week needs and the others ignore.
 */
export function isDue(state: HabibitState, habit: Habit, day: DateKey): boolean {
  return isDueOn(parseSchedule(habit.schedule), day, (other) => isCompleted(state, habit.id, other));
}

/** Habits due today, in display order. */
export function dueHabits(state: HabibitState, today: DateKey): Habit[] {
  return activeHabits(state).filter((h) => isDue(state, h, today));
}

/**
 * Habits that are not due today — shown below the others, in a quieter colour
 * (your choice), rather than hidden. A habit you can't see is a habit you
 * forget you have, and it stays tappable for the day you do it anyway.
 */
export function restingHabits(state: HabibitState, today: DateKey): Habit[] {
  return activeHabits(state).filter((h) => !isDue(state, h, today));
}

/**
 * How many of today's habits are checked — the "2/3" in the section header.
 *
 * Only habits actually due today are counted, on both sides of the slash: a
 * Monday-only habit shouldn't make Tuesday look unfinished. A habit you tick on
 * a day it wasn't due is kept and shown as done, but doesn't move this count —
 * it can't, or the total would read 3/2.
 */
export function completedCount(state: HabibitState, date: DateKey): number {
  return dueHabits(state, date).filter((h) => isCompleted(state, h.id, date)).length;
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
 * A run of kept days — or, for an N-times-a-week habit, of kept **weeks**.
 *
 * The unit travels with the number because the badge has to say which it is:
 * "3" under a three-times-a-week habit means three weeks, and calling those
 * days would be a lie.
 */
export type Streak = { count: number; unit: 'day' | 'week' };

const NO_STREAK: Streak = { count: 0, unit: 'day' };

/**
 * How long this habit has been kept up, counting back from today.
 *
 * Two rules hold for every kind of schedule:
 *
 * - **An unfinished today never breaks a streak.** If today isn't done yet the
 *   count starts from yesterday, so a streak stays alive all day and only
 *   reaches zero once a day has actually been missed.
 * - **A day the habit wasn't due neither breaks the streak nor adds to it.** A
 *   Mon/Wed/Fri habit kept every Mon, Wed and Fri has an unbroken streak, and
 *   the Tuesdays in between are simply not part of the question.
 *
 * N times a week is counted in whole weeks instead: a week counts when it met
 * its target, and the week in progress can't break anything either.
 *
 * A streak that resets for no reason is the fastest way to stop trusting a
 * habit tracker, so every rule above is a test in `store/streaks.test.ts`.
 */
export function habitStreak(state: HabibitState, habit: Habit, today: DateKey): Streak {
  const schedule = parseSchedule(habit.schedule);
  const done = (day: DateKey) => isCompleted(state, habit.id, day);

  if (schedule.kind === 'weekly') {
    return { count: weeksMeetingTarget(done, schedule.times, today), unit: 'week' };
  }

  /*
   * Where to stop. Walking back day by day ends at the first day that was due
   * and missed — which always arrives, because every schedule has at least one
   * due day a week. The habit's first day is a second floor, so a brand-new
   * habit can't walk back through years of days that never existed. A run that
   * reaches further back than the habit (a day backfilled in the strip) is
   * still counted, because it was really kept.
   */
  const firstDay = dateKey(new Date(habit.createdAt));
  let cursor = done(today) ? today : addDaysToKey(today, -1);
  let count = 0;

  while (done(cursor) || cursor >= firstDay) {
    if (done(cursor)) count += 1;
    else if (isDueOn(schedule, cursor, done)) break;
    cursor = addDaysToKey(cursor, -1);
  }

  return count === 0 ? NO_STREAK : { count, unit: 'day' };
}

/** Whole weeks, ending with this one, in which the habit hit N. */
function weeksMeetingTarget(done: (day: DateKey) => boolean, times: number, today: DateKey): number {
  const keptIn = (monday: DateKey) => weekOf(monday).filter(done).length;

  let monday = weekStart(today);
  // This week is still running, so falling short of the target so far can't
  // break anything — the count simply starts from last week.
  if (keptIn(monday) < times) monday = addDaysToKey(monday, -7);

  let weeks = 0;
  while (keptIn(monday) >= times) {
    weeks += 1;
    monday = addDaysToKey(monday, -7);
  }
  return weeks;
}

// ---------------------------------------------------------------------------
// The review: four weeks of history per habit (v3 Block C). Reading only —
// nothing here changes anything, and the review has no way to tick a day.
// ---------------------------------------------------------------------------

/**
 * The last `weeks` Monday-to-Sunday weeks, ending with the week `today` is in.
 *
 * Whole weeks rather than "the last 28 days" so every column is one weekday,
 * which is what makes a calendar readable at a glance. The final row therefore
 * runs past today when today isn't Sunday; those days are simply not yet.
 */
export function reviewWeeks(today: DateKey, weeks = 4): DateKey[][] {
  const start = addDaysToKey(today, -mondayIndex(today) - 7 * (weeks - 1));
  return Array.from({ length: weeks }, (_, week) =>
    Array.from({ length: 7 }, (_, day) => addDaysToKey(start, week * 7 + day)),
  );
}

/**
 * What one square in the calendar means.
 *
 * `before`, `future` and `unscheduled` are all quiet on screen, and they are
 * three different things: a habit you made last Tuesday didn't fail on the
 * Monday before it, and a Mon/Wed/Fri habit didn't fail on Thursday.
 */
export type ReviewDay = 'done' | 'missed' | 'unscheduled' | 'before' | 'future';

export function reviewDay(state: HabibitState, habit: Habit, day: DateKey, today: DateKey): ReviewDay {
  if (day > today) return 'future';
  // The habit's first day, in the user's own timezone, like every other date here.
  if (day < dateKey(new Date(habit.createdAt))) return 'before';
  /*
   * Done wins over everything. A day you kept is a day you kept, even if the
   * habit isn't scheduled then any more — changing a schedule must never
   * rewrite what you actually did.
   */
  if (isCompleted(state, habit.id, day)) return 'done';
  return isDue(state, habit, day) ? 'missed' : 'unscheduled';
}

export type HabitReview = {
  days: { day: DateKey; state: ReviewDay }[][];
  /** Days kept, out of the days this habit could have been kept. */
  kept: number;
  possible: number;
  /** The longest run of kept days inside the window. */
  best: number;
};

export function habitReview(state: HabibitState, habit: Habit, today: DateKey, weeks = 4): HabitReview {
  const days = reviewWeeks(today, weeks).map((week) =>
    week.map((day) => ({ day, state: reviewDay(state, habit, day, today) })),
  );

  let kept = 0;
  let possible = 0;
  let best = 0;
  let run = 0;
  for (const { state: dayState } of days.flat()) {
    if (dayState === 'before' || dayState === 'future') continue;
    // A day the habit wasn't due is not one of the days it could have been
    // kept, and it doesn't interrupt a run either — the same rule the streak
    // uses, so the two numbers can never disagree.
    if (dayState === 'unscheduled') continue;
    possible += 1;
    if (dayState === 'done') {
      kept += 1;
      run += 1;
      best = Math.max(best, run);
    } else {
      run = 0;
    }
  }

  return { days, kept, possible, best };
}
