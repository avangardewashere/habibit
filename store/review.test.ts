import { describe, expect, it } from 'vitest';
import { weekdayInitial } from '@/lib/date';
import type { DateKey, Habit, HabibitState } from '@/lib/types';
import { completionKey } from '@/lib/keys';
import { habitReview, reviewDay, reviewWeeks } from './selectors';

/* A Sunday, so the "today is mid-week" cases have to be written out on purpose. */
const TODAY: DateKey = '2026-09-20';

function habit(createdAt: string, id = 'h1'): Habit {
  return {
    id,
    title: 'Drink water',
    createdAt,
    updatedAt: createdAt,
    archivedAt: null,
    deletedAt: null,
    position: 'V',
  };
}

function stateWith(days: DateKey[], h: Habit): HabibitState {
  return {
    habits: [h],
    tasks: [],
    completions: Object.fromEntries(
      days.map((day) => [completionKey(h.id, day), { done: true, updatedAt: `${day}T08:00:00.000Z` }]),
    ) as HabibitState['completions'],
  };
}

describe('reviewWeeks', () => {
  it('V3C-01 · ⭐ four Monday-to-Sunday weeks, ending with the week today is in', () => {
    const weeks = reviewWeeks(TODAY);

    expect(weeks).toHaveLength(4);
    expect(weeks.every((week) => week.length === 7)).toBe(true);
    // Today is a Sunday, so its week ends on today and the window is 24 Aug – 20 Sep.
    expect(weeks.flat()[0]).toBe('2026-08-24');
    expect(weeks.at(-1)!.at(-1)).toBe('2026-09-20');
    expect(weeks.flat()).toContain(TODAY);
  });

  it('V3C-02 · every column is the same weekday, Monday first', () => {
    for (const today of ['2026-09-16', '2026-09-20', '2026-01-01', '2026-03-02']) {
      const weeks = reviewWeeks(today);
      const initials = weeks.map((week) => week.map(weekdayInitial).join(''));
      expect(initials).toEqual(Array(4).fill('MTWTFSS'));
      expect(weeks.flat()).toContain(today);
    }
  });

  it('V3C-03 · the days run without a gap across a month end, a year end and a leap day', () => {
    for (const today of ['2026-03-03', '2027-01-02', '2028-03-01']) {
      const days = reviewWeeks(today).flat();
      expect(days).toHaveLength(28);
      expect(new Set(days).size).toBe(28);
      for (let i = 1; i < days.length; i += 1) {
        const gap = (Date.parse(`${days[i]}T12:00:00Z`) - Date.parse(`${days[i - 1]}T12:00:00Z`)) / 86_400_000;
        expect(gap, `${days[i - 1]} → ${days[i]}`).toBe(1);
      }
    }
    // 2028 is a leap year: the 29th of February exists and is in the window.
    expect(reviewWeeks('2028-03-01').flat()).toContain('2028-02-29');
  });

  it('the last row runs past today when today is mid-week', () => {
    const weeks = reviewWeeks('2026-09-16'); // a Wednesday
    expect(weeks.at(-1)).toEqual([
      '2026-09-14',
      '2026-09-15',
      '2026-09-16',
      '2026-09-17',
      '2026-09-18',
      '2026-09-19',
      '2026-09-20',
    ]);
  });
});

describe('what a day in the review means', () => {
  const made = habit('2026-09-10T02:00:00.000Z');

  it('V3C-04 · ⭐ days before the habit existed are blank, not missed', () => {
    const state = stateWith([], made);
    expect(reviewDay(state, made, '2026-09-09', TODAY)).toBe('before');
    expect(reviewDay(state, made, '2026-09-10', TODAY)).toBe('missed');
  });

  it('V3C-05 · days after today are blank too, and never counted', () => {
    const state = stateWith([], made);
    expect(reviewDay(state, made, '2026-09-21', TODAY)).toBe('future');
    expect(reviewDay(state, made, TODAY, TODAY)).toBe('missed');
  });

  it('a kept day is done, an unticked one is missed', () => {
    const state = stateWith(['2026-09-12'], made);
    expect(reviewDay(state, made, '2026-09-12', TODAY)).toBe('done');
    expect(reviewDay(state, made, '2026-09-13', TODAY)).toBe('missed');
    // An untick is stored as done: false, and reads as missed.
    const unticked: HabibitState = {
      ...state,
      completions: { [completionKey(made.id, '2026-09-12')]: { done: false, updatedAt: '2026-09-12T09:00:00.000Z' } },
    };
    expect(reviewDay(unticked, made, '2026-09-12', TODAY)).toBe('missed');
  });
});

describe('habitReview', () => {
  it('V3C-06 · ⭐ counts only the days the habit could have been kept', () => {
    // Made on the Thursday of the third week: 11 days of the 28 are possible
    // (10 up to yesterday, plus today), and three of them were kept.
    const made = habit('2026-09-10T02:00:00.000Z');
    const review = habitReview(stateWith(['2026-09-11', '2026-09-12', '2026-09-19'], made), made, TODAY);

    expect(review.possible).toBe(11);
    expect(review.kept).toBe(3);
    expect(review.days.flat().filter((d) => d.state === 'before')).toHaveLength(17);
    expect(review.days.flat().filter((d) => d.state === 'future')).toHaveLength(0);
  });

  it('V3C-07 · best streak is the longest run inside the window', () => {
    const made = habit('2026-01-01T02:00:00.000Z');
    const review = habitReview(
      stateWith(['2026-09-01', '2026-09-02', '2026-09-03', '2026-09-10', '2026-09-11'], made),
      made,
      TODAY,
    );
    expect(review.best).toBe(3);
    expect(review.kept).toBe(5);
    expect(review.possible).toBe(28); // an old habit, so all 28 days count
  });

  it('V3C-08 · a run that started before the window counts only its days inside it', () => {
    const made = habit('2026-01-01T02:00:00.000Z');
    // A seven-day run from the 20th to the 26th of August. The window opens on
    // the 24th, so only the 24th, 25th and 26th are inside it.
    const run: DateKey[] = [];
    for (let d = 20; d <= 26; d += 1) run.push(`2026-08-${d}`);

    const review = habitReview(stateWith(run, made), made, TODAY);
    expect(review.best).toBe(3);
    expect(review.kept).toBe(3);
  });

  it('a habit with nothing ticked reads as zero, not as an error', () => {
    const made = habit('2026-09-19T02:00:00.000Z');
    const review = habitReview(stateWith([], made), made, TODAY);
    expect(review).toMatchObject({ kept: 0, best: 0, possible: 2 });
  });
});
