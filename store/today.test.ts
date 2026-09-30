import { describe, expect, it } from 'vitest';
import { completionKey } from '@/lib/keys';
import type { DateKey, Habit, HabibitState } from '@/lib/types';
import { completedCount, dueHabits, isDue, restingHabits } from './selectors';

/*
 * v4 Block C: today's list, once habits have schedules.
 *
 * Due habits come first; the rest sit below rather than disappearing (your
 * choice). The "2/3" counts only what is actually due, on both sides.
 *
 *   2026-09-28 Mon · 29 Tue · 30 Wed  ← today
 */

const TODAY: DateKey = '2026-09-30';

function habit(id: string, title: string, schedule: string | null, position: string): Habit {
  return {
    id,
    title,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    archivedAt: null,
    deletedAt: null,
    position,
    schedule,
  };
}

function stateOf(habits: Habit[], kept: [string, DateKey][] = []): HabibitState {
  return {
    habits,
    tasks: [],
    completions: Object.fromEntries(
      kept.map(([id, day]) => [completionKey(id, day), { done: true, updatedAt: `${day}T08:00:00.000Z` }]),
    ) as HabibitState['completions'],
  };
}

const titles = (habits: Habit[]) => habits.map((h) => h.title);

describe('what is due today', () => {
  it('V4C-20 · ⭐ a Mon/Wed/Fri habit is due on Wednesday and not on Thursday', () => {
    const run = habit('h1', 'Run', 'weekdays:0,2,4', 'a');
    const state = stateOf([run]);

    expect(isDue(state, run, '2026-09-30')).toBe(true);
    expect(isDue(state, run, '2026-10-01')).toBe(false);
  });

  it('V4C-21 · ⭐ a few-times-a-week habit stops being due once the week’s target is met', () => {
    const gym = habit('h1', 'Gym', 'weekly:2', 'a');
    expect(isDue(stateOf([gym]), gym, TODAY)).toBe(true);

    const met = stateOf([gym], [['h1', '2026-09-28'], ['h1', '2026-09-29']]);
    expect(isDue(met, gym, TODAY)).toBe(false);
    // …but the day it was kept still counts as due that day, so ticking it
    // never makes it vanish from the list you are looking at.
    expect(isDue(met, gym, '2026-09-29')).toBe(true);
  });

  it('V4C-22 · ⭐ the list is due habits first, then the resting ones, each in order', () => {
    const state = stateOf([
      habit('h1', 'Run', 'weekdays:0,2,4', 'a'), // due (Wednesday)
      habit('h2', 'Read', null, 'b'), // due (every day)
      habit('h3', 'Yoga', 'weekdays:6', 'c'), // Sundays only
      habit('h4', 'Call mum', 'weekdays:0', 'd'), // Mondays only
    ]);

    expect(titles(dueHabits(state, TODAY))).toEqual(['Run', 'Read']);
    expect(titles(restingHabits(state, TODAY))).toEqual(['Yoga', 'Call mum']);
  });

  it('V4C-23 · ⭐ the count counts only what is due today', () => {
    // Two due, one of them kept, plus a Sunday habit that is nobody's business
    // on a Wednesday. Without this the header would read 1/3 for ever on
    // Wednesdays, which is the "always behind" feeling schedules exist to fix.
    const state = stateOf(
      [
        habit('h1', 'Run', 'weekdays:0,2,4', 'a'),
        habit('h2', 'Read', null, 'b'),
        habit('h3', 'Yoga', 'weekdays:6', 'c'),
      ],
      [['h1', TODAY]],
    );

    expect(dueHabits(state, TODAY)).toHaveLength(2);
    expect(completedCount(state, TODAY)).toBe(1);
  });

  it('V4C-24 · ⭐ keeping a habit on a day off never makes the count read 3/2', () => {
    const state = stateOf(
      [habit('h1', 'Run', 'weekdays:0,2,4', 'a'), habit('h2', 'Yoga', 'weekdays:6', 'b')],
      [['h1', TODAY], ['h2', TODAY]],
    );

    expect(completedCount(state, TODAY)).toBe(1);
    expect(dueHabits(state, TODAY)).toHaveLength(1);
  });

  it('V4C-25 · archived and deleted habits are in neither list', () => {
    const state = stateOf([
      { ...habit('h1', 'Run', null, 'a'), archivedAt: '2026-09-01T00:00:00.000Z' },
      { ...habit('h2', 'Read', 'weekdays:6', 'b'), deletedAt: '2026-09-01T00:00:00.000Z' },
      habit('h3', 'Walk', null, 'c'),
    ]);

    expect(titles(dueHabits(state, TODAY))).toEqual(['Walk']);
    expect(restingHabits(state, TODAY)).toEqual([]);
  });

  it('V4C-26 · ⭐ a schedule written by a newer build shows up as due, not hidden', () => {
    // It cannot be read here, so it behaves as every day. Hiding a habit on the
    // strength of something we do not understand would be the worse guess.
    const future = habit('h1', 'Water plants', 'every:3d', 'a');
    expect(isDue(stateOf([future]), future, TODAY)).toBe(true);
    expect(titles(dueHabits(stateOf([future]), TODAY))).toEqual(['Water plants']);
  });
});
