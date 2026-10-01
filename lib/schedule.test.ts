import { describe, expect, it } from 'vitest';
import { addDaysToKey } from './date';
import {
  DAILY,
  describeSchedule,
  formatSchedule,
  isDueOn,
  isStoredSchedule,
  keptElsewhereInWeek,
  parseSchedule,
  timesAWeek,
  weekOf,
  weekdays,
  weekStart,
  type Schedule,
  type Weekday,
} from './schedule';
import type { DateKey } from './types';

/*
 * v4 Block B: how often a habit is meant to be kept.
 *
 * `isDueOn` is the one answer to "is this habit due on this date?", and streaks,
 * the review and per-habit reminders will all ask it rather than each working it
 * out again. So it gets the treatment the reminder time zones got in v3: every
 * case written out, including the two that have caught this app before — a week
 * that crosses a month or year boundary, and a day when the clocks change.
 *
 * Monday is 0 throughout, matching `mondayIndex` and the day strip.
 */

const MON: Weekday = 0;
const WED: Weekday = 2;
const FRI: Weekday = 4;
const SUN: Weekday = 6;

/** 2026-09-07 is a Monday. */
const MONDAY: DateKey = '2026-09-07';
const week = (from: DateKey, length = 14) => Array.from({ length }, (_, i) => addDaysToKey(from, i));

describe('reading and writing a schedule', () => {
  it('V4B-01 · ⭐ a habit with nothing stored is every day', () => {
    // Every habit made before v4 is in this state, so this is the case that
    // decides whether anybody's list changes on the day this ships.
    expect(parseSchedule(null)).toEqual(DAILY);
    expect(parseSchedule(undefined)).toEqual(DAILY);
    expect(parseSchedule('')).toEqual(DAILY);
    expect(parseSchedule('daily')).toEqual(DAILY);
  });

  it('V4B-02 · ⭐ every schedule survives being written and read back', () => {
    const all: Schedule[] = [
      DAILY,
      weekdays([MON, WED, FRI]),
      weekdays([SUN]),
      timesAWeek(1),
      timesAWeek(3),
      timesAWeek(6),
    ];
    for (const schedule of all) {
      expect(parseSchedule(formatSchedule(schedule)), JSON.stringify(schedule)).toEqual(schedule);
    }
  });

  it('V4B-03 · ⭐ the stored form is the same however the days were chosen', () => {
    // Two devices that picked the same days must write the same text, or sync
    // would see an edit every time and upload the row again, for ever.
    expect(formatSchedule(weekdays([FRI, MON, WED]))).toBe('weekdays:0,2,4');
    expect(formatSchedule(weekdays([MON, MON, WED, FRI]))).toBe('weekdays:0,2,4');
    expect(formatSchedule(weekdays([MON, WED, FRI]))).toBe('weekdays:0,2,4');
    expect(formatSchedule(timesAWeek(3))).toBe('weekly:3');
  });

  it('V4B-04 · every day has exactly one stored form: nothing', () => {
    // All seven days, or none at all, or "seven times a week" — each of them is
    // every day, and each is stored as null so there is one row to compare.
    expect(formatSchedule(DAILY)).toBeNull();
    expect(formatSchedule({ kind: 'weekdays', days: [0, 1, 2, 3, 4, 5, 6] })).toBeNull();
    expect(formatSchedule({ kind: 'weekdays', days: [] })).toBeNull();
    expect(formatSchedule({ kind: 'weekly', times: 7 })).toBeNull();
    expect(weekdays([0, 1, 2, 3, 4, 5, 6])).toEqual(DAILY);
    expect(timesAWeek(7)).toEqual(DAILY);
  });

  it('V4B-05 · a nonsense number of times a week is every day, not no days', () => {
    for (const times of [0, -2, 1.5, Number.NaN, Infinity]) {
      expect(timesAWeek(times), String(times)).toEqual(times === 1.5 ? { kind: 'weekly', times: 1 } : DAILY);
    }
  });

  it('V4B-06 · ⭐ a schedule this build has never heard of reads as every day', () => {
    // What a *newer* build will write. Showing the habit every day is the
    // forgiving answer; hiding it would look like the habit had vanished.
    expect(parseSchedule('every:3d')).toEqual(DAILY);
    expect(parseSchedule('monthly:1')).toEqual(DAILY);
    expect(parseSchedule('weekdays:9')).toEqual(DAILY);
    expect(parseSchedule('weekdays:')).toEqual(DAILY);
    expect(parseSchedule('weekdays:0,x')).toEqual(DAILY);
    expect(parseSchedule('weekly:x')).toEqual(DAILY);
  });

  it('V4B-07 · ⭐ …and it is still worth keeping, so it is not erased', () => {
    // The pair to V4B-06: unreadable here, but kept exactly as stored, because
    // the build that wrote it knows what it means. See lib/schedule.ts.
    expect(isStoredSchedule('every:3d')).toBe(true);
    expect(isStoredSchedule('monthly:1')).toBe(true);
    expect(isStoredSchedule(null)).toBe(true);
    expect(isStoredSchedule('weekdays:0,2,4')).toBe(true);
  });

  it('V4B-08 · but nonsense is not kept at all', () => {
    for (const value of ['WEEKLY:3', 'weekly 3', 'drop table', '', '<script>', 'a'.repeat(65), 7, {}, undefined]) {
      expect(isStoredSchedule(value), JSON.stringify(value) ?? 'undefined').toBe(false);
    }
  });

  it('V4B-09 · a schedule says what it is, in words', () => {
    expect(describeSchedule(DAILY)).toBe('Every day');
    expect(describeSchedule(weekdays([MON, WED, FRI]))).toBe('Mon, Wed and Fri');
    expect(describeSchedule(weekdays([SUN]))).toBe('Sundays');
    expect(describeSchedule(timesAWeek(3))).toBe('3 times a week');
  });
});

describe('is this habit due today?', () => {
  it('V4B-10 · every day is due every day', () => {
    for (const day of week(MONDAY, 30)) expect(isDueOn(DAILY, day), day).toBe(true);
  });

  it('V4B-11 · ⭐ chosen weekdays are due on exactly those days, fortnight after fortnight', () => {
    const schedule = weekdays([MON, WED, FRI]);
    const due = week(MONDAY).filter((day) => isDueOn(schedule, day));
    expect(due).toEqual([
      '2026-09-07', '2026-09-09', '2026-09-11',
      '2026-09-14', '2026-09-16', '2026-09-18',
    ]);
  });

  it('V4B-12 · ⭐ the weekday is still right across a month and a year boundary', () => {
    const sundays = weekdays([SUN]);
    // 2026-11-29 and 2027-01-03 are Sundays either side of a month and a year end.
    expect(isDueOn(sundays, '2026-11-29')).toBe(true);
    expect(isDueOn(sundays, '2026-11-30')).toBe(false);
    expect(isDueOn(sundays, '2026-12-31')).toBe(false);
    expect(isDueOn(sundays, '2027-01-03')).toBe(true);
    // And a leap day: 2028-02-29 is a Tuesday.
    expect(isDueOn(weekdays([1]), '2028-02-29')).toBe(true);
    expect(isDueOn(sundays, '2028-02-29')).toBe(false);
  });

  it('V4B-13 · a habit due on no days at all is impossible: it reads as every day', () => {
    expect(isDueOn(weekdays([]), MONDAY)).toBe(true);
    expect(isDueOn(parseSchedule('weekdays:'), MONDAY)).toBe(true);
  });
});

describe('N times a week', () => {
  const thrice = timesAWeek(3);
  /** Kept on exactly these days. */
  const kept = (...days: DateKey[]) => (day: DateKey) => days.includes(day);

  it('V4B-14 · ⭐ due until the week has enough kept days, then not', () => {
    expect(isDueOn(thrice, '2026-09-10', kept())).toBe(true);
    expect(isDueOn(thrice, '2026-09-10', kept('2026-09-07', '2026-09-08'))).toBe(true);
    expect(isDueOn(thrice, '2026-09-10', kept('2026-09-07', '2026-09-08', '2026-09-09'))).toBe(false);
  });

  it('V4B-15 · ⭐ ticking it today does not make it stop being due today', () => {
    // Otherwise the habit would disappear out from under your thumb the moment
    // you ticked it — the day itself is deliberately not counted.
    const alreadyThree = kept('2026-09-07', '2026-09-08', '2026-09-10');
    expect(isDueOn(thrice, '2026-09-10', alreadyThree)).toBe(true);
    // The next day, with those same three kept, it is done for the week.
    expect(isDueOn(thrice, '2026-09-11', alreadyThree)).toBe(false);
  });

  it('V4B-16 · ⭐ the count starts again on Monday', () => {
    const lastWeek = kept('2026-09-07', '2026-09-08', '2026-09-09');
    expect(isDueOn(thrice, '2026-09-13', lastWeek)).toBe(false); // Sunday, same week
    expect(isDueOn(thrice, '2026-09-14', lastWeek)).toBe(true); // Monday, a fresh week
  });

  it('V4B-17 · days in the weeks either side are not counted', () => {
    const neighbours = kept('2026-09-06', '2026-09-05', '2026-09-14', '2026-09-15', '2026-09-16');
    expect(keptElsewhereInWeek('2026-09-10', neighbours)).toBe(0);
    expect(isDueOn(thrice, '2026-09-10', neighbours)).toBe(true);
  });

  it('V4B-18 · asked without any history, it is due', () => {
    // The forgiving direction: a caller that cannot say what was kept gets the
    // habit shown rather than silently hidden.
    expect(isDueOn(thrice, '2026-09-10')).toBe(true);
  });

  it('V4B-19 · once a week is due all week until it is kept', () => {
    const once = timesAWeek(1);
    for (const day of weekOf(MONDAY)) expect(isDueOn(once, day, kept()), day).toBe(true);
    for (const day of weekOf(MONDAY)) {
      expect(isDueOn(once, day, kept('2026-09-09')), day).toBe(day === '2026-09-09');
    }
  });
});

describe('the week a day belongs to', () => {
  it('V4B-20 · weeks run Monday to Sunday', () => {
    expect(weekStart('2026-09-07')).toBe('2026-09-07'); // Monday itself
    expect(weekStart('2026-09-13')).toBe('2026-09-07'); // the Sunday after it
    expect(weekOf('2026-09-10')).toEqual(week('2026-09-07', 7));
  });

  it('V4B-21 · a week that crosses a month or a year still has seven days', () => {
    expect(weekOf('2026-12-31')).toEqual(['2026-12-28', '2026-12-29', '2026-12-30', '2026-12-31', '2027-01-01', '2027-01-02', '2027-01-03']);
    expect(weekOf('2028-03-01')).toContain('2028-02-29');
  });
});

