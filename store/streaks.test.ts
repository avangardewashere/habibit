import { describe, expect, it } from 'vitest';
import { completionKey } from '@/lib/keys';
import type { DateKey, HabibitState } from '@/lib/types';
import { habibitReducer, stamp } from './reducer';
import { habitStreak } from './selectors';

/*
 * v4 Block C: what a streak means once a habit has a schedule.
 *
 * A streak that resets for no reason is the fastest way to stop trusting a
 * habit tracker, so every rule is written out here as its own case: kept days,
 * missed days, days the habit was never due, the week in progress, and the
 * moment a schedule changes under an existing history.
 *
 * Dates, for reading the cases below:
 *   2026-09-21 Mon · 22 Tue · 23 Wed · 24 Thu · 25 Fri · 26 Sat · 27 Sun
 *   2026-09-28 Mon · 29 Tue · 30 Wed  ← today
 */

const TODAY: DateKey = '2026-09-30';
const MON_WED_FRI = 'weekdays:0,2,4';
const MONDAYS = 'weekdays:0';

function state(schedule: string | null, kept: DateKey[], createdAt = '2026-01-01T00:00:00.000Z'): HabibitState {
  return {
    habits: [
      {
        id: 'h1',
        title: 'Run',
        createdAt,
        updatedAt: createdAt,
        archivedAt: null,
        position: null,
        schedule,
        deletedAt: null,
      },
    ],
    tasks: [],
    completions: Object.fromEntries(
      kept.map((day) => [completionKey('h1', day), { done: true, updatedAt: `${day}T08:00:00.000Z` }]),
    ),
  };
}

const streak = (s: HabibitState, today: DateKey = TODAY) => habitStreak(s, s.habits[0], today);

describe('a habit kept on certain weekdays', () => {
  const everyDueDay: DateKey[] = ['2026-09-21', '2026-09-23', '2026-09-25', '2026-09-28', '2026-09-30'];

  it('V4C-01 · ⭐ kept every Mon, Wed and Fri, the streak is unbroken', () => {
    // The headline promise of this block: the Tuesdays in between are not
    // failures, and the run counts the days actually kept.
    expect(streak(state(MON_WED_FRI, everyDueDay))).toEqual({ count: 5, unit: 'day' });
  });

  it('V4C-02 · ⭐ the very same history on an every-day habit is a streak of one', () => {
    // The contrast that shows V4C-01 is the schedule doing the work, not the
    // walk being generous: as a daily habit this history breaks at yesterday.
    expect(streak(state(null, everyDueDay))).toEqual({ count: 1, unit: 'day' });
  });

  it('V4C-03 · ⭐ a missed Wednesday does break it', () => {
    const kept = ['2026-09-21', '2026-09-25', '2026-09-28', '2026-09-30'] as DateKey[];
    expect(streak(state(MON_WED_FRI, kept)).count).toBe(3);
  });

  it('V4C-04 · ⭐ an unfinished today does not break it, even on a day it is due', () => {
    const kept = ['2026-09-21', '2026-09-23', '2026-09-25', '2026-09-28'] as DateKey[];
    expect(streak(state(MON_WED_FRI, kept)).count).toBe(4);
  });

  it('V4C-05 · ⭐ on a day it is not due, the streak is simply the one it had', () => {
    // Today is Tuesday: nothing is expected, and nothing is at risk.
    const kept = ['2026-09-21', '2026-09-23', '2026-09-25', '2026-09-28'] as DateKey[];
    expect(streak(state(MON_WED_FRI, kept), '2026-09-29').count).toBe(4);
  });

  it('V4C-06 · ⭐ a day kept when it was not due still counts', () => {
    // Doing it anyway is doing it. It adds to the run; skipping it never would
    // have subtracted.
    const kept = [...everyDueDay, '2026-09-29'] as DateKey[];
    expect(streak(state(MON_WED_FRI, kept)).count).toBe(6);
  });

  it('V4C-07 · a run crosses a month boundary', () => {
    const mondays = ['2026-08-31', '2026-09-07', '2026-09-14', '2026-09-21', '2026-09-28'] as DateKey[];
    expect(streak(state(MONDAYS, mondays)).count).toBe(5);
  });

  it('V4C-08 · a habit made today has no streak until it is kept, and never looks further back', () => {
    const born = `${TODAY}T01:00:00.000Z`;
    expect(streak(state(MON_WED_FRI, [], born)).count).toBe(0);
    expect(streak(state(MON_WED_FRI, [TODAY], born)).count).toBe(1);
  });

  it('V4C-09 · a habit due on one weekday, never kept, has no streak (and the walk ends)', () => {
    expect(streak(state(MONDAYS, [])).count).toBe(0);
  });
});

describe('a habit kept a few times a week', () => {
  /*
   * Weeks run Monday to Sunday. Today is Wednesday 30 September, so this week
   * is 28 Sep – 4 Oct, last week 21–27, the one before 14–20.
   */
  const thrice = 'weekly:3';

  it('V4C-10 · ⭐ the run is counted in weeks, and says so', () => {
    const kept = [
      '2026-09-28', '2026-09-29', '2026-09-30', // this week: 3
      '2026-09-21', '2026-09-22', '2026-09-23', // last week: 3
      '2026-09-14', '2026-09-15', // the week before: 2
    ] as DateKey[];

    expect(streak(state(thrice, kept))).toEqual({ count: 2, unit: 'week' });
  });

  it('V4C-11 · ⭐ a week still in progress cannot break the run', () => {
    // Wednesday, one run done out of three. Nothing has been missed yet.
    const kept = [
      '2026-09-28',
      '2026-09-21', '2026-09-22', '2026-09-23',
      '2026-09-14', '2026-09-15', '2026-09-16',
    ] as DateKey[];

    expect(streak(state(thrice, kept)).count).toBe(2);
  });

  it('V4C-12 · ⭐ a finished week that fell short ends it', () => {
    const kept = [
      '2026-09-28', '2026-09-29', '2026-09-30',
      '2026-09-21', '2026-09-22', // last week: only 2
      '2026-09-14', '2026-09-15', '2026-09-16',
    ] as DateKey[];

    expect(streak(state(thrice, kept)).count).toBe(1);
  });

  it('V4C-13 · more than the target in one week is still one week', () => {
    const kept = [
      '2026-09-28', '2026-09-29', '2026-09-30',
      '2026-09-21', '2026-09-22', '2026-09-23', '2026-09-24', '2026-09-25', '2026-09-26',
    ] as DateKey[];

    expect(streak(state(thrice, kept)).count).toBe(2);
  });

  it('V4C-14 · hitting the target exactly counts, one short does not', () => {
    const met = ['2026-09-21', '2026-09-23', '2026-09-25'] as DateKey[];
    expect(streak(state(thrice, met)).count).toBe(1);
    expect(streak(state(thrice, met.slice(0, 2))).count).toBe(0);
  });

  it('V4C-15 · once a week counts the weeks it was kept at all', () => {
    const kept = ['2026-09-30', '2026-09-24', '2026-09-17', '2026-09-03'] as DateKey[];
    // This week, last week, the week before — then the week of 7 Sep is empty.
    expect(streak(state('weekly:1', kept))).toEqual({ count: 3, unit: 'week' });
  });
});

describe('changing a schedule never rewrites the past', () => {
  it('V4C-16 · ⭐ the history is untouched, and days already kept still count', () => {
    const daily = state(null, ['2026-09-28', '2026-09-29', '2026-09-30']);
    const before = { ...daily.completions };

    const changed = habibitReducer(
      daily,
      stamp({ type: 'SET_SCHEDULE', id: 'h1', schedule: { kind: 'weekdays', days: [0, 2, 4] } }, new Date(`${TODAY}T10:00:00.000Z`)),
    );

    // Not one completion added, removed or altered.
    expect(changed.completions).toEqual(before);
    // Monday, Tuesday and Wednesday were all kept; Tuesday is now a day off,
    // which takes nothing away.
    expect(streak(changed).count).toBe(3);
  });

  it('V4C-17 · ⭐ and a day that is no longer scheduled still shows as kept', () => {
    const kept = ['2026-09-29'] as DateKey[]; // a Tuesday
    const mwf = state(MON_WED_FRI, kept);
    expect(mwf.completions[completionKey('h1', '2026-09-29')].done).toBe(true);
    // Today (Wednesday) is due and unfinished, so the walk starts yesterday and
    // finds that Tuesday.
    expect(streak(mwf).count).toBe(1);
  });
});
