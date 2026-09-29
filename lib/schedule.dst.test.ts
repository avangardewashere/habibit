import { describe, expect, it } from 'vitest';
import { isDueOn, keptElsewhereInWeek, weekdays, weekOf, weekStart } from './schedule';

/*
 * v4 Block B, the day the clocks change.
 *
 * Runs under vitest.dst.config.mts, pinned to Santiago, where the clocks go
 * **forward at midnight**: on 2026-09-06 local midnight does not exist, and a
 * date built at midnight lands on the previous day. Every date step in
 * lib/schedule.ts goes through `addDaysToKey`, which anchors at noon for this
 * reason.
 *
 * The main suite runs at UTC+8, which has no daylight saving at all, so these
 * assertions would pass there while proving nothing. That is why they live in
 * their own file and their own run — and why the first test below checks the
 * timezone really is the one that makes the rest mean something.
 */

const MON = 0;
const SUN = 6;

describe('a week in a timezone whose clocks change', () => {
  it('V4B-22 · the run really is in a daylight-saving timezone (or nothing below counts)', () => {
    // 2026-09-06 in Santiago is UTC-3 (summer time), and 00:00 does not exist:
    // asking for midnight gives 01:00. If this ever fails, the tests after it
    // are running somewhere without daylight saving and prove nothing.
    expect(new Date(2026, 8, 6, 12).getTimezoneOffset()).toBe(180);
    expect(new Date(2026, 8, 6, 0).getHours()).toBe(1);
  });

  it('V4B-23 · ⭐ the weekday is right on a day that has no midnight', () => {
    expect(isDueOn(weekdays([SUN]), '2026-09-06')).toBe(true);
    expect(isDueOn(weekdays([MON]), '2026-09-06')).toBe(false);
    expect(isDueOn(weekdays([MON]), '2026-09-07')).toBe(true);
  });

  it('V4B-24 · ⭐ the week around it still has seven days, in order', () => {
    expect(weekStart('2026-09-06')).toBe('2026-08-31');
    expect(weekOf('2026-09-06')).toEqual([
      '2026-08-31',
      '2026-09-01',
      '2026-09-02',
      '2026-09-03',
      '2026-09-04',
      '2026-09-05',
      '2026-09-06',
    ]);
  });

  it('V4B-25 · ⭐ and the clocks going back does not repeat or lose a day', () => {
    // Santiago goes back on 2027-04-04: that Sunday is 25 hours long.
    expect(weekOf('2027-04-04')).toEqual([
      '2027-03-29',
      '2027-03-30',
      '2027-03-31',
      '2027-04-01',
      '2027-04-02',
      '2027-04-03',
      '2027-04-04',
    ]);
    expect(isDueOn(weekdays([SUN]), '2027-04-04')).toBe(true);
    // Three times a week counts the same seven days either way.
    expect(keptElsewhereInWeek('2027-04-04', (day) => day === '2027-03-29')).toBe(1);
  });
});
