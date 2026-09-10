import { describe, expect, it } from 'vitest';
import { completionKey } from '@/lib/keys';
import type { DateKey, HabibitState } from '@/lib/types';
import { currentStreak, recentDays } from './selectors';

const TODAY: DateKey = '2026-09-08';

/** A state with one habit completed on exactly the given days. */
function withCompletions(days: DateKey[], habitId = 'h1'): HabibitState {
  return {
    habits: [
      {
        id: habitId,
        title: 'Drink water',
        emoji: null,
        createdAt: '2026-01-01T00:00:00.000Z',
        archivedAt: null,
      },
    ],
    tasks: [],
    completions: Object.fromEntries(
      days.map((day) => [completionKey(habitId, day), '2026-09-08T01:00:00.000Z']),
    ),
  };
}

describe('recentDays', () => {
  it('returns the seven days ending today, oldest first', () => {
    expect(recentDays(TODAY)).toEqual([
      '2026-09-02',
      '2026-09-03',
      '2026-09-04',
      '2026-09-05',
      '2026-09-06',
      '2026-09-07',
      '2026-09-08',
    ]);
  });

  it('always ends on today and never includes tomorrow', () => {
    const days = recentDays(TODAY);
    expect(days.at(-1)).toBe(TODAY);
    expect(days).not.toContain('2026-09-09');
  });

  it('crosses a month boundary cleanly', () => {
    expect(recentDays('2026-10-02', 4)).toEqual([
      '2026-09-29',
      '2026-09-30',
      '2026-10-01',
      '2026-10-02',
    ]);
  });

  it('honours a custom count', () => {
    expect(recentDays(TODAY, 1)).toEqual([TODAY]);
    expect(recentDays(TODAY, 3)).toHaveLength(3);
  });
});

describe('currentStreak', () => {
  it('is zero with no completions at all', () => {
    expect(currentStreak(withCompletions([]), 'h1', TODAY)).toBe(0);
  });

  it('counts today alone as one', () => {
    expect(currentStreak(withCompletions([TODAY]), 'h1', TODAY)).toBe(1);
  });

  it('counts a run ending today', () => {
    const state = withCompletions(['2026-09-06', '2026-09-07', '2026-09-08']);
    expect(currentStreak(state, 'h1', TODAY)).toBe(3);
  });

  it('SURVIVES an unfinished today — the streak stays alive until midnight', () => {
    // Yesterday and the day before are done; today has not been ticked yet.
    const state = withCompletions(['2026-09-06', '2026-09-07']);
    expect(currentStreak(state, 'h1', TODAY)).toBe(2);
  });

  it('reaches zero only once a whole day has been missed', () => {
    // Done up to the day before yesterday, then nothing. Yesterday was missed.
    const state = withCompletions(['2026-09-05', '2026-09-06']);
    expect(currentStreak(state, 'h1', TODAY)).toBe(0);
  });

  it('stops at the first gap rather than counting every completion', () => {
    const state = withCompletions([
      '2026-09-01',
      '2026-09-02',
      // gap on the 3rd
      '2026-09-07',
      '2026-09-08',
    ]);
    expect(currentStreak(state, 'h1', TODAY)).toBe(2);
  });

  it('counts a run that crosses a month boundary', () => {
    const state = withCompletions(['2026-08-30', '2026-08-31', '2026-09-01'], 'h1');
    expect(currentStreak(state, 'h1', '2026-09-01')).toBe(3);
  });

  it('ignores completions dated in the future', () => {
    // A clock skew or hand-edited storage should not inflate the streak.
    const state = withCompletions(['2026-09-08', '2026-09-09', '2026-09-10']);
    expect(currentStreak(state, 'h1', TODAY)).toBe(1);
  });

  it('does not let one habit borrow another habit’s history', () => {
    const state = withCompletions(['2026-09-06', '2026-09-07', '2026-09-08'], 'h1');
    state.habits.push({
      id: 'h2',
      title: 'Stretch',
      emoji: null,
      createdAt: '2026-01-01T00:00:00.000Z',
      archivedAt: null,
    });

    expect(currentStreak(state, 'h1', TODAY)).toBe(3);
    expect(currentStreak(state, 'h2', TODAY)).toBe(0);
  });

  it('is zero for a habit that does not exist', () => {
    expect(currentStreak(withCompletions([TODAY]), 'nope', TODAY)).toBe(0);
  });
});
