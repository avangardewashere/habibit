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

describe('HYDRATE', () => {
  it('replaces the whole state', () => {
    const seeded = run([
      { type: 'ADD_HABIT', title: 'Old' },
      { type: 'ADD_TASK', title: 'Old task' },
    ]);
    const incoming = run([{ type: 'ADD_HABIT', title: 'From storage' }]);

    const next = habibitReducer(seeded, { type: 'HYDRATE', state: incoming });

    expect(next).toEqual(incoming);
    expect(next.habits.map((h) => h.title)).toEqual(['From storage']);
    expect(next.tasks).toHaveLength(0);
  });

  it('does not mutate either state', () => {
    const seeded = run([{ type: 'ADD_HABIT', title: 'Old' }]);
    const incoming = run([{ type: 'ADD_HABIT', title: 'New' }]);
    const seededSnapshot = structuredClone(seeded);
    const incomingSnapshot = structuredClone(incoming);

    habibitReducer(seeded, { type: 'HYDRATE', state: incoming });

    expect(seeded).toEqual(seededSnapshot);
    expect(incoming).toEqual(incomingSnapshot);
  });

  it('round-trips through the reducer after being restored', () => {
    const restored = habibitReducer(initialState, {
      type: 'HYDRATE',
      state: run([{ type: 'ADD_HABIT', title: 'Water' }]),
    });
    const id = restored.habits[0].id;

    const toggled = habibitReducer(restored, {
      type: 'TOGGLE_COMPLETION',
      habitId: id,
      dateKey: DAY_A,
    });

    expect(isCompleted(toggled, id, DAY_A)).toBe(true);
  });
});

describe('RENAME_HABIT', () => {
  it('changes the title and trims it', () => {
    let state = run([{ type: 'ADD_HABIT', title: 'Drink watr' }]);
    const { id } = state.habits[0];

    state = habibitReducer(state, { type: 'RENAME_HABIT', id, title: '  Drink water  ' });

    expect(state.habits[0].title).toBe('Drink water');
    expect(state.habits[0].id).toBe(id);
  });

  it('keeps the whole completion history — the reason ids exist', () => {
    let state = run([{ type: 'ADD_HABIT', title: 'Drink watr' }]);
    const { id } = state.habits[0];
    state = run(
      [
        { type: 'TOGGLE_COMPLETION', habitId: id, dateKey: DAY_A },
        { type: 'TOGGLE_COMPLETION', habitId: id, dateKey: DAY_B },
      ],
      state,
    );
    const historyBefore = state.completions;

    state = habibitReducer(state, { type: 'RENAME_HABIT', id, title: 'Drink water' });

    expect(state.completions).toBe(historyBefore);
    expect(isCompleted(state, id, DAY_A)).toBe(true);
    expect(isCompleted(state, id, DAY_B)).toBe(true);
  });

  it('rejects an empty or whitespace-only title instead of deleting', () => {
    const state = run([{ type: 'ADD_HABIT', title: 'Stretch' }]);
    const { id } = state.habits[0];

    expect(habibitReducer(state, { type: 'RENAME_HABIT', id, title: '' })).toBe(state);
    expect(habibitReducer(state, { type: 'RENAME_HABIT', id, title: '   ' })).toBe(state);
  });

  it('returns the same state when the title does not actually change', () => {
    const state = run([{ type: 'ADD_HABIT', title: 'Stretch' }]);
    const { id } = state.habits[0];
    expect(habibitReducer(state, { type: 'RENAME_HABIT', id, title: ' Stretch ' })).toBe(state);
  });

  it('ignores an unknown id', () => {
    const state = run([{ type: 'ADD_HABIT', title: 'Stretch' }]);
    expect(habibitReducer(state, { type: 'RENAME_HABIT', id: 'nope', title: 'X' })).toBe(state);
  });

  it('renames only the named habit, even when titles collide', () => {
    let state = run([
      { type: 'ADD_HABIT', title: 'Stretch' },
      { type: 'ADD_HABIT', title: 'Stretch' },
    ]);
    const [first, second] = state.habits;

    state = habibitReducer(state, { type: 'RENAME_HABIT', id: second.id, title: 'Yoga' });

    expect(state.habits.find((h) => h.id === first.id)?.title).toBe('Stretch');
    expect(state.habits.find((h) => h.id === second.id)?.title).toBe('Yoga');
  });
});

describe('RENAME_TASK', () => {
  it('changes the title and keeps it done if it was done', () => {
    let state = run([{ type: 'ADD_TASK', title: 'Book dentst' }]);
    const { id } = state.tasks[0];
    state = habibitReducer(state, { type: 'TOGGLE_TASK', id });
    const completedAt = state.tasks[0].completedAt;

    state = habibitReducer(state, { type: 'RENAME_TASK', id, title: 'Book dentist' });

    expect(state.tasks[0].title).toBe('Book dentist');
    expect(state.tasks[0].completedAt).toBe(completedAt);
  });

  it('rejects an empty title', () => {
    const state = run([{ type: 'ADD_TASK', title: 'Pay rent' }]);
    const { id } = state.tasks[0];
    expect(habibitReducer(state, { type: 'RENAME_TASK', id, title: '  ' })).toBe(state);
  });

  it('does not touch habits', () => {
    let state = run([
      { type: 'ADD_HABIT', title: 'Water' },
      { type: 'ADD_TASK', title: 'Pay rent' },
    ]);
    const habitsBefore = state.habits;

    state = habibitReducer(state, { type: 'RENAME_TASK', id: state.tasks[0].id, title: 'Pay rent!' });

    expect(state.habits).toBe(habitsBefore);
  });
});
