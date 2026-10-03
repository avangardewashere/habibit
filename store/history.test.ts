import { describe, expect, it } from 'vitest';
import { addDaysToKey } from '@/lib/date';
import { completionKey } from '@/lib/keys';
import type { DateKey, Habit, HabibitState } from '@/lib/types';
import { bestEver, firstDayOf, habitReview, habitStreak, reviewWeeks, sinceYouStarted, YEAR_WEEKS } from './selectors';

/*
 * v4 Block D: more than four weeks of history.
 *
 * Three numbers — a year at a glance, the best run ever, and how long you have
 * been at it — and not one of them is allowed to invent its own rules. They
 * read the same schedule rules as the streak on the list (Block C), so the
 * review and the badge can never contradict each other.
 *
 *   2026-09-28 Mon · 29 Tue · 30 Wed  ← today
 */

const TODAY: DateKey = '2026-09-30';
const MON_WED_FRI = 'weekdays:0,2,4';

function habit(schedule: string | null, createdAt = '2025-01-01T00:00:00.000Z'): Habit {
  return {
    id: 'h1',
    title: 'Run',
    createdAt,
    updatedAt: createdAt,
    archivedAt: null,
    position: null,
    schedule,
    icon: null,
    colour: null,
    deletedAt: null,
  };
}

function stateOf(h: Habit, kept: DateKey[]): HabibitState {
  return {
    habits: [h],
    tasks: [],
    completions: Object.fromEntries(
      kept.map((day) => [completionKey('h1', day), { done: true, updatedAt: `${day}T08:00:00.000Z` }]),
    ),
  };
}

/** `count` days in a row, ending on `end`. */
function run(end: DateKey, count: number): DateKey[] {
  return Array.from({ length: count }, (_, i) => addDaysToKey(end, -i));
}

describe('the best run ever', () => {
  it('V4D-01 · ⭐ finds a run that happened long before the last four weeks', () => {
    const h = habit(null);
    // Nine days in a row in February, and three this week.
    const state = stateOf(h, [...run('2025-02-20', 9), ...run(TODAY, 3)]);

    expect(bestEver(state, h, TODAY)).toEqual({ count: 9, unit: 'day' });
    // …while the streak on the list is still about right now.
    expect(habitStreak(state, h, TODAY)).toEqual({ count: 3, unit: 'day' });
  });

  it('V4D-02 · ⭐ it counts the schedule’s days, not the calendar’s', () => {
    const h = habit(MON_WED_FRI);
    // Every Mon, Wed and Fri for three weeks: nine kept days, unbroken.
    const kept: DateKey[] = [
      '2026-09-07', '2026-09-09', '2026-09-11',
      '2026-09-14', '2026-09-16', '2026-09-18',
      '2026-09-21', '2026-09-23', '2026-09-25',
    ];

    expect(bestEver(stateOf(h, kept), h, TODAY).count).toBe(9);
    // The same history as an every-day habit: the best run is a single day.
    expect(bestEver(stateOf(habit(null), kept), habit(null), TODAY).count).toBe(1);
  });

  it('V4D-03 · ⭐ for a few-times-a-week habit it counts weeks', () => {
    const h = habit('weekly:2');
    const kept: DateKey[] = [
      '2026-09-07', '2026-09-09', // week of 7 Sep
      '2026-09-14', '2026-09-16', // week of 14 Sep
      '2026-09-21', // week of 21 Sep: one short
      '2026-09-28', '2026-09-29', // this week
    ];

    expect(bestEver(stateOf(h, kept), h, TODAY)).toEqual({ count: 2, unit: 'week' });
  });

  it('V4D-04 · ⭐ an unfinished today cannot lower a best that already happened', () => {
    const h = habit(null);
    const state = stateOf(h, run('2026-09-29', 5)); // ends yesterday

    expect(bestEver(state, h, TODAY).count).toBe(5);
  });

  it('V4D-05 · a habit never kept has no best run', () => {
    const h = habit(MON_WED_FRI);
    expect(bestEver(stateOf(h, []), h, TODAY)).toEqual({ count: 0, unit: 'day' });
  });

  it('V4D-06 · ⭐ when the current run is the best one, the two agree exactly', () => {
    // The guard against the two walks drifting apart: same state, same answer.
    for (const schedule of [null, MON_WED_FRI, 'weekly:2']) {
      const h = habit(schedule);
      const state = stateOf(h, [
        '2026-09-14', '2026-09-16', '2026-09-18',
        '2026-09-21', '2026-09-23', '2026-09-25',
        '2026-09-28', '2026-09-30',
      ]);

      expect(bestEver(state, h, TODAY), String(schedule)).toEqual(habitStreak(state, h, TODAY));
    }
  });
});

describe('since you started', () => {
  it('V4D-07 · ⭐ counts every tick, over the days since the first one', () => {
    const h = habit(null, '2026-09-01T02:00:00.000Z');
    const state = stateOf(h, ['2026-09-02', '2026-09-05', '2026-09-30']);

    expect(sinceYouStarted(state, h, TODAY)).toEqual({ times: 3, days: 30, from: '2026-09-01' });
  });

  it('V4D-08 · a tick dated in the future is not something you have done', () => {
    const h = habit(null, '2026-09-01T02:00:00.000Z');
    const state = stateOf(h, ['2026-09-30', '2026-10-05']);

    expect(sinceYouStarted(state, h, TODAY).times).toBe(1);
  });

  it('V4D-09 · ⭐ a day backfilled before the habit was made counts, and moves the start', () => {
    const h = habit(null, '2026-09-28T02:00:00.000Z');
    const state = stateOf(h, ['2026-09-24', '2026-09-29']);

    expect(firstDayOf(state, h)).toBe('2026-09-24');
    expect(sinceYouStarted(state, h, TODAY)).toMatchObject({ times: 2, days: 7 });
  });

  it('V4D-10 · an untick is not a tick', () => {
    const h = habit(null, '2026-09-28T02:00:00.000Z');
    const state = stateOf(h, ['2026-09-29']);
    state.completions[completionKey('h1', '2026-09-29')] = { done: false, updatedAt: '2026-09-29T09:00:00.000Z' };

    expect(sinceYouStarted(state, h, TODAY).times).toBe(0);
    expect(firstDayOf(state, h)).toBe('2026-09-28');
  });
});

describe('a year at a glance', () => {
  it('V4D-11 · ⭐ 53 whole weeks, Monday first, ending with the week today is in', () => {
    const weeks = reviewWeeks(TODAY, YEAR_WEEKS);

    expect(weeks).toHaveLength(53);
    expect(weeks.flat()).toHaveLength(371);
    expect(weeks.at(-1)).toContain(TODAY);
    expect(weeks[0][0]).toBe('2025-09-29'); // a Monday, a year and a few days back
    expect(new Set(weeks.flat()).size).toBe(371);
  });

  it('V4D-12 · ⭐ a leap day appears once, and the run of days never skips', () => {
    const days = reviewWeeks('2028-03-01', YEAR_WEEKS).flat();

    expect(days.filter((day) => day === '2028-02-29')).toHaveLength(1);
    for (let i = 1; i < days.length; i += 1) {
      expect(addDaysToKey(days[i - 1], 1), days[i]).toBe(days[i]);
    }
  });

  it('V4D-13 · ⭐ a habit made last week shows a year of nothing, not a year of misses', () => {
    const h = habit(null, '2026-09-24T02:00:00.000Z');
    const review = habitReview(stateOf(h, ['2026-09-29']), h, TODAY, YEAR_WEEKS);
    const states = review.days.flat().map((d) => d.state);

    expect(states.filter((s) => s === 'before')).toHaveLength(360);
    expect(states.filter((s) => s === 'missed')).toHaveLength(6);
    expect(review.possible).toBe(7);
  });

  it('V4D-14 · ⭐ a few-times-a-week habit is counted in weeks, not days', () => {
    // The bug this block found in Block C's numbers: counted in days, a
    // twice-a-week habit nobody has started reads "0 of 371 days", as though
    // it should have been done every single day.
    const h = habit('weekly:2');
    const review = habitReview(stateOf(h, []), h, TODAY, YEAR_WEEKS);

    expect(review.unit).toBe('week');
    expect(review.possible).toBe(52); // the 53rd is this week, still running
    expect(review.kept).toBe(0);
  });

  it('V4D-15 · ⭐ the week in progress is not counted against it', () => {
    const h = habit('weekly:2', '2026-09-28T02:00:00.000Z'); // made this Monday
    const review = habitReview(stateOf(h, ['2026-09-28']), h, TODAY, YEAR_WEEKS);

    // One of two done so far, and the week is not over: nothing to report yet.
    expect(review).toMatchObject({ kept: 0, possible: 0, unit: 'week' });

    const met = habitReview(stateOf(h, ['2026-09-28', '2026-09-29']), h, TODAY, YEAR_WEEKS);
    expect(met).toMatchObject({ kept: 1, possible: 1, best: 1 });
  });
});
