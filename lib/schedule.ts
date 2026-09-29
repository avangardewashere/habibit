import { addDaysToKey, mondayIndex } from './date';
import type { DateKey } from './types';

/**
 * How often a habit is meant to be kept.
 *
 * Three kinds, your choice at the start of Block B:
 *
 * - **every day** — what every habit made before v4 is, so nobody's list changes;
 * - **chosen weekdays** — Mon, Wed, Fri;
 * - **N times a week** — three times, any days you like.
 *
 * `isDueOn` below is the one function that answers *"is this habit due on this
 * date?"*. Streaks, the review and per-habit reminders all ask it rather than
 * each working it out again, so there is one rule to test and one to get right.
 */
export type Schedule =
  | { kind: 'daily' }
  | { kind: 'weekdays'; days: Weekday[] }
  | { kind: 'weekly'; times: number };

/** 0 for Monday … 6 for Sunday, matching `mondayIndex` and the day strip. */
export type Weekday = 0 | 1 | 2 | 3 | 4 | 5 | 6;

/** The most times a week worth choosing: 7 is simply every day. */
export const MOST_TIMES_A_WEEK = 6;

const DAY_NAMES = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'] as const;
const SHORT_DAY_NAMES = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'] as const;

export const DAILY: Schedule = { kind: 'daily' };

/**
 * A stored schedule is **text**, and the habit keeps it exactly as it was read.
 *
 * Two reasons it is not stored as an object:
 *
 * - **A newer build's schedule survives an older one.** A phone can run the
 *   version it last loaded for days. If v5 adds "every third day" and this build
 *   turned what it can't read into "every day", the next edit made here — a
 *   rename, a tick — would upload that and quietly erase it everywhere. Keeping
 *   the text and only *interpreting* it means an unknown schedule passes through
 *   this build untouched, and merely behaves as every day while it's here.
 * - **A round trip has to compare equal.** Sync decides what to upload by
 *   comparing records; JSON read back with its keys in another order would look
 *   like an edit, and every sync would re-upload everything. Text can't drift.
 *
 * `null` means every day. It is the only representation of daily, so a habit
 * from before v4 and a habit you explicitly set back to daily are the same row.
 */
export type StoredSchedule = string | null;

/**
 * The longest stored schedule this app will keep. Matches the database's own
 * limit (supabase/migrations/…_habit_schedule.sql).
 */
export const LONGEST_SCHEDULE = 64;

/**
 * Is this something worth keeping in the `schedule` field?
 *
 * Deliberately **not** a list of the kinds this build knows: a schedule from a
 * newer build has to survive being read and written back here (see
 * `StoredSchedule`). It only checks the shape — lowercase kind, optional
 * argument, bounded length — so a nonsense value can't reach the database and a
 * future kind isn't locked out. What it *means* is `parseSchedule`'s job, and
 * anything unrecognised there simply reads as every day.
 */
export function isStoredSchedule(value: unknown): value is StoredSchedule {
  if (value === null) return true;
  return (
    typeof value === 'string' &&
    value.length <= LONGEST_SCHEDULE &&
    /^[a-z]+(:[0-9a-z,]+)?$/.test(value)
  );
}

/**
 * Text form → schedule. Anything it cannot read is **every day**.
 *
 * Lenient on purpose: this reads rows written by other builds, by an older app
 * on another device, and by hand. A schedule it doesn't understand must not
 * hide a habit from today's list, so the fallback is the one that shows it.
 */
export function parseSchedule(stored: StoredSchedule | undefined): Schedule {
  if (typeof stored !== 'string' || stored === 'daily' || stored === '') return DAILY;

  const separator = stored.indexOf(':');
  const kind = separator === -1 ? stored : stored.slice(0, separator);
  const rest = separator === -1 ? '' : stored.slice(separator + 1);

  if (kind === 'weekdays') {
    const days = rest
      .split(',')
      .map((part) => (/^[0-6]$/.test(part) ? (Number(part) as Weekday) : null));
    // One unreadable day makes the whole thing unreadable: guessing which days
    // were meant is worse than showing the habit every day.
    if (days.some((day) => day === null)) return DAILY;
    return weekdays(days as Weekday[]);
  }

  if (kind === 'weekly' && /^[0-9]{1,2}$/.test(rest)) return timesAWeek(Number(rest));

  return DAILY;
}

/**
 * Schedule → text form, in one canonical shape: days always ascending and
 * without repeats, and anything that means "every day" stored as `null`.
 */
export function formatSchedule(schedule: Schedule): StoredSchedule {
  switch (schedule.kind) {
    case 'daily':
      return null;
    case 'weekdays': {
      const days = sortedDays(schedule.days);
      // No days at all would hide the habit for ever, and all seven is daily.
      if (days.length === 0 || days.length === 7) return null;
      return `weekdays:${days.join(',')}`;
    }
    case 'weekly': {
      const times = Math.trunc(schedule.times);
      if (!Number.isFinite(times) || times < 1 || times > MOST_TIMES_A_WEEK) return null;
      return `weekly:${times}`;
    }
    default: {
      const unhandled: never = schedule;
      return unhandled;
    }
  }
}

/** A weekdays schedule, tidied: ascending, no repeats, all seven means daily. */
export function weekdays(days: Weekday[]): Schedule {
  const tidy = sortedDays(days);
  if (tidy.length === 0 || tidy.length === 7) return DAILY;
  return { kind: 'weekdays', days: tidy };
}

/** An N-times-a-week schedule, tidied: out-of-range counts mean daily. */
export function timesAWeek(times: number): Schedule {
  const whole = Math.trunc(times);
  if (!Number.isFinite(whole) || whole < 1 || whole > MOST_TIMES_A_WEEK) return DAILY;
  return { kind: 'weekly', times: whole };
}

function sortedDays(days: Weekday[]): Weekday[] {
  return [...new Set(days.filter((day) => Number.isInteger(day) && day >= 0 && day <= 6))].sort((a, b) => a - b);
}

/** The Monday of the week `day` falls in. Weeks run Monday to Sunday, as everywhere else in the app. */
export function weekStart(day: DateKey): DateKey {
  return addDaysToKey(day, -mondayIndex(day));
}

/** The seven days of `day`'s week, Monday first. */
export function weekOf(day: DateKey): DateKey[] {
  const monday = weekStart(day);
  return Array.from({ length: 7 }, (_, offset) => addDaysToKey(monday, offset));
}

/**
 * **Is this habit due on this date?**
 *
 * `isDone` answers "was it kept on that day?" and is only ever asked for
 * N-times-a-week, which is the one kind that depends on what you've already
 * done. Leaving it out means "nothing kept yet", which errs towards showing the
 * habit rather than hiding it.
 *
 * For N times a week, the day itself is deliberately **not** counted: ticking a
 * habit must not make it stop being due that day and disappear out from under
 * your thumb. So a three-times-a-week habit is due until three *other* days
 * this week have been kept.
 *
 * Pure — no clock, no state, no React. Every date step goes through
 * `lib/date.ts`, so the daylight-saving trap that a `-86_400_000` would walk
 * into is handled in one place.
 */
export function isDueOn(schedule: Schedule, day: DateKey, isDone: (day: DateKey) => boolean = () => false): boolean {
  switch (schedule.kind) {
    case 'daily':
      return true;
    case 'weekdays':
      return schedule.days.includes(mondayIndex(day) as Weekday);
    case 'weekly':
      return keptElsewhereInWeek(day, isDone) < schedule.times;
    default: {
      const unhandled: never = schedule;
      return unhandled;
    }
  }
}

/** How many *other* days in `day`'s week were kept. */
export function keptElsewhereInWeek(day: DateKey, isDone: (day: DateKey) => boolean): number {
  return weekOf(day).filter((other) => other !== day && isDone(other)).length;
}

/** e.g. "Every day", "Mon, Wed and Fri", "3 times a week". Used on screen and in accessible names. */
export function describeSchedule(schedule: Schedule): string {
  switch (schedule.kind) {
    case 'daily':
      return 'Every day';
    case 'weekdays': {
      const names = schedule.days.map((day) => SHORT_DAY_NAMES[day]);
      if (names.length === 1) return `${DAY_NAMES[schedule.days[0]]}s`;
      return `${names.slice(0, -1).join(', ')} and ${names.at(-1)}`;
    }
    case 'weekly':
      return `${schedule.times} times a week`;
    default: {
      const unhandled: never = schedule;
      return unhandled;
    }
  }
}

/** The full weekday name, for the accessible name of a day toggle. */
export function weekdayName(day: Weekday): string {
  return DAY_NAMES[day];
}

/** The short weekday name, for the face of a day toggle. */
export function shortWeekdayName(day: Weekday): string {
  return SHORT_DAY_NAMES[day];
}
