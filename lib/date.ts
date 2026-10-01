import type { DateKey } from './types';

/**
 * The local calendar day as `YYYY-MM-DD`.
 *
 * NEVER use `d.toISOString().slice(0, 10)` for this. That returns the **UTC**
 * day, so at UTC+8 every habit would silently roll over to "tomorrow" at 08:00
 * local time — checkmarks vanishing mid-morning and streaks breaking for no
 * visible reason. `getFullYear/getMonth/getDate` read the local calendar, which
 * is what "did I do this today?" actually means.
 */
export function dateKey(d: Date): DateKey {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function todayKey(): DateKey {
  return dateKey(new Date());
}

/** e.g. "Sunday, September 7". Client-only — the server cannot know the user's timezone. */
export function formatDayLabel(d: Date): string {
  return new Intl.DateTimeFormat('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
  }).format(d);
}

/**
 * Turns a `YYYY-MM-DD` key back into a Date at local midnight.
 *
 * NEVER use `new Date('2026-09-07')` for this. The bare date form is parsed as
 * **UTC** midnight, which lands on the previous evening anywhere west of
 * Greenwich and shifts the weekday for a large part of the world.
 */
export function parseDateKey(key: DateKey): Date {
  const [year, month, day] = key.split('-').map(Number);
  return new Date(year, month - 1, day);
}

/**
 * Steps a day key forward or backward.
 *
 * NEVER step days with `time +/- 86_400_000`. On a daylight-saving boundary that
 * lands 23 or 25 hours away and silently returns the wrong day, so a streak
 * would break once a year for anyone who observes DST.
 *
 * The noon anchor matters too: in zones that have skipped midnight when the
 * clocks jump (Brazil has done this), local midnight does not exist on that
 * date. Noon is never ambiguous. The Date constructor handles the month, year
 * and leap-day rollover.
 */
export function addDaysToKey(key: DateKey, delta: number): DateKey {
  const [year, month, day] = key.split('-').map(Number);
  return dateKey(new Date(year, month - 1, day + delta, 12));
}

/** A single letter for the weekday column headers: S M T W T F S. */
export function weekdayInitial(key: DateKey): string {
  return new Intl.DateTimeFormat('en-US', { weekday: 'narrow' }).format(parseDateKey(key));
}

/** e.g. "Tuesday, September 8" — the accessible name for a day in the strip. */
export function formatDateKeyLong(key: DateKey): string {
  return formatDayLabel(parseDateKey(key));
}

/** 0 for Monday … 6 for Sunday. Weeks start on Monday, like the day strip. */
export function mondayIndex(key: DateKey): number {
  return (parseDateKey(key).getDay() + 6) % 7;
}

/**
 * A rough length of time in words: "11 days", "6 weeks", "7 months", "2 years".
 *
 * Deliberately coarse. "Since you started" is a sense of how long you have been
 * at this, not an audit — "7 months" says it better than "213 days", and nobody
 * reads the second one as anything but noise.
 */
export function describeSpan(days: number): string {
  const plural = (count: number, unit: string) => `${count} ${unit}${count === 1 ? '' : 's'}`;
  if (days < 14) return plural(Math.max(1, days), 'day');
  if (days < 61) return plural(Math.round(days / 7), 'week');
  if (days < 730) return plural(Math.round(days / 30.44), 'month');
  return plural(Math.round((days / 365.25) * 10) / 10, 'year');
}

/** e.g. "24 Aug" — the short form used either side of the review's date range. */
export function formatDateKeyShort(key: DateKey): string {
  return new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short' }).format(parseDateKey(key));
}

/**
 * e.g. "24 Aug – 20 Sep", or "29 Sep 2025 – 1 Oct 2026" when the range crosses
 * a new year.
 *
 * Without the years, a year-long range reads as three days (v4 Block D found
 * exactly that: "29 Sept – 1 Oct" over the whole of last year).
 */
export function formatDateRange(from: DateKey, to: DateKey): string {
  const sameYear = from.slice(0, 4) === to.slice(0, 4);
  const show = (key: DateKey) =>
    new Intl.DateTimeFormat('en-GB', {
      day: 'numeric',
      month: 'short',
      ...(sameYear ? {} : { year: 'numeric' }),
    }).format(parseDateKey(key));
  return `${show(from)} – ${show(to)}`;
}
