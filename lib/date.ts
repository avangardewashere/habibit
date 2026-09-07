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
