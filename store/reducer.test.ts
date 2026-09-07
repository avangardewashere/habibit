import { describe, expect, it } from 'vitest';
import { completionKey } from '@/lib/keys';
import type { HabibitState } from '@/lib/types';
import { habibitReducer, initialState, type HabibitAction } from './reducer';
import { completedCount, isCompleted, sortedTasks } from './selectors';

/** Applies a list of actions in order, like the UI would. */
function run(actions: HabibitAction[], from: HabibitState = initialState): HabibitState {
  return actions.reduce(habibitReducer, from);
}

const DAY_A = '2026-09-07';
const DAY_B = '2026-09-08';

describe('habits', () => {
  it('adds a habit with a generated id and a trimmed title', () => {
    const state = run([{ type: 'ADD_HABIT', title: '  Drink water  ' }]);

    expect(state.habits).toHaveLength(1);
    expect(state.habits[0].title).toBe('Drink water');
    expect(state.habits[0].id).toBeTruthy();
    expect(state.habits[0].archivedAt).toBeNull();
  });

  it('ignores empty and whitespace-only titles', () => {
    const state = run([
      { type: 'ADD_HABIT', title: '' },
      { type: 'ADD_HABIT', title: '   ' },
    ]);
    expect(state.habits).toHaveLength(0);
  });

  it('gives two habits with the same title distinct ids', () => {
    const state = run([
      { type: 'ADD_HABIT', title: 'Stretch' },
      { type: 'ADD_HABIT', title: 'Stretch' },
    ]);
    expect(state.habits).toHaveLength(2);
    expect(state.habits[0].id).not.toBe(state.habits[1].id);
  });

  it('removes a habit and purges its completions, leaving others intact', () => {
    let state = run([
      { type: 'ADD_HABIT', title: 'Water' },
      { type: 'ADD_HABIT', title: 'Read' },
    ]);
    const [water, read] = state.habits;

    state = run(
      [
        { type: 'TOGGLE_COMPLETION', habitId: water.id, dateKey: DAY_A },
        { type: 'TOGGLE_COMPLETION', habitId: read.id, dateKey: DAY_A },
        { type: 'REMOVE_HABIT', id: water.id },
      ],
      state,
    );

    expect(state.habits.map((h) => h.title)).toEqual(['Read']);
    expect(state.completions[completionKey(water.id, DAY_A)]).toBeUndefined();
    expect(state.completions[completionKey(read.id, DAY_A)]).toBeTruthy();
  });

  it('ignores removal of an unknown habit', () => {
    const state = run([{ type: 'ADD_HABIT', title: 'Water' }]);
    expect(habibitReducer(state, { type: 'REMOVE_HABIT', id: 'nope' })).toBe(state);
  });
});

describe('completions', () => {
  it('toggling twice is a clean round trip', () => {
    let state = run([{ type: 'ADD_HABIT', title: 'Water' }]);
    const { id } = state.habits[0];

    state = habibitReducer(state, { type: 'TOGGLE_COMPLETION', habitId: id, dateKey: DAY_A });
    expect(isCompleted(state, id, DAY_A)).toBe(true);

    state = habibitReducer(state, { type: 'TOGGLE_COMPLETION', habitId: id, dateKey: DAY_A });
    expect(isCompleted(state, id, DAY_A)).toBe(false);
    expect(Object.keys(state.completions)).toHaveLength(0);
  });

  it('is scoped to a single day, which is what makes it a habit and not a task', () => {
    let state = run([{ type: 'ADD_HABIT', title: 'Water' }]);
    const { id } = state.habits[0];

    state = habibitReducer(state, { type: 'TOGGLE_COMPLETION', habitId: id, dateKey: DAY_A });

    expect(isCompleted(state, id, DAY_A)).toBe(true);
    expect(isCompleted(state, id, DAY_B)).toBe(false);
  });

  it('toggles two same-titled habits independently', () => {
    let state = run([
      { type: 'ADD_HABIT', title: 'Stretch' },
      { type: 'ADD_HABIT', title: 'Stretch' },
    ]);
    const [first, second] = state.habits;

    state = habibitReducer(state, { type: 'TOGGLE_COMPLETION', habitId: first.id, dateKey: DAY_A });

    expect(isCompleted(state, first.id, DAY_A)).toBe(true);
    expect(isCompleted(state, second.id, DAY_A)).toBe(false);
  });

  it('ignores a completion for an unknown habit', () => {
    const state = run([{ type: 'ADD_HABIT', title: 'Water' }]);
    const next = habibitReducer(state, {
      type: 'TOGGLE_COMPLETION',
      habitId: 'nope',
      dateKey: DAY_A,
    });
    expect(next).toBe(state);
  });

  it('counts completions per day for the section header', () => {
    let state = run([
      { type: 'ADD_HABIT', title: 'Water' },
      { type: 'ADD_HABIT', title: 'Read' },
      { type: 'ADD_HABIT', title: 'Stretch' },
    ]);
    const [water, read] = state.habits;

    state = run(
      [
        { type: 'TOGGLE_COMPLETION', habitId: water.id, dateKey: DAY_A },
        { type: 'TOGGLE_COMPLETION', habitId: read.id, dateKey: DAY_A },
      ],
      state,
    );

    expect(completedCount(state, DAY_A)).toBe(2);
    expect(completedCount(state, DAY_B)).toBe(0);
  });
});

describe('tasks', () => {
  it('adds, completes and reopens a task', () => {
    let state = run([{ type: 'ADD_TASK', title: '  Book dentist  ' }]);
    const { id } = state.tasks[0];
    expect(state.tasks[0].title).toBe('Book dentist');
    expect(state.tasks[0].completedAt).toBeNull();

    state = habibitReducer(state, { type: 'TOGGLE_TASK', id });
    expect(state.tasks[0].completedAt).toBeTruthy();

    state = habibitReducer(state, { type: 'TOGGLE_TASK', id });
    expect(state.tasks[0].completedAt).toBeNull();
  });

  it('ignores empty titles', () => {
    expect(run([{ type: 'ADD_TASK', title: '   ' }]).tasks).toHaveLength(0);
  });

  it('sinks completed tasks to the bottom while preserving order within groups', () => {
    let state = run([
      { type: 'ADD_TASK', title: 'One' },
      { type: 'ADD_TASK', title: 'Two' },
      { type: 'ADD_TASK', title: 'Three' },
    ]);

    state = habibitReducer(state, { type: 'TOGGLE_TASK', id: state.tasks[0].id });

    expect(sortedTasks(state).map((t) => t.title)).toEqual(['Two', 'Three', 'One']);
  });

  it('removes only the named task', () => {
    let state = run([
      { type: 'ADD_TASK', title: 'One' },
      { type: 'ADD_TASK', title: 'Two' },
    ]);
    state = habibitReducer(state, { type: 'REMOVE_TASK', id: state.tasks[0].id });
    expect(state.tasks.map((t) => t.title)).toEqual(['Two']);
  });

  it('does not touch habits when a task is toggled', () => {
    let state = run([
      { type: 'ADD_HABIT', title: 'Water' },
      { type: 'ADD_TASK', title: 'Book dentist' },
    ]);
    const habitsBefore = state.habits;

    state = habibitReducer(state, { type: 'TOGGLE_TASK', id: state.tasks[0].id });

    expect(state.habits).toBe(habitsBefore);
    expect(state.completions).toEqual({});
  });
});

describe('purity', () => {
  it('never mutates the state it is given', () => {
    const state = run([
      { type: 'ADD_HABIT', title: 'Water' },
      { type: 'ADD_TASK', title: 'Book dentist' },
    ]);
    const snapshot = structuredClone(state);
    const habitId = state.habits[0].id;

    habibitReducer(state, { type: 'ADD_HABIT', title: 'Read' });
    habibitReducer(state, { type: 'TOGGLE_COMPLETION', habitId, dateKey: DAY_A });
    habibitReducer(state, { type: 'TOGGLE_TASK', id: state.tasks[0].id });
    habibitReducer(state, { type: 'REMOVE_HABIT', id: habitId });

    expect(state).toEqual(snapshot);
  });

  it('returns the same reference when nothing changed', () => {
    const state = run([{ type: 'ADD_HABIT', title: 'Water' }]);
    expect(habibitReducer(state, { type: 'ADD_HABIT', title: '  ' })).toBe(state);
  });
});
