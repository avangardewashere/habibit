import { beforeEach, describe, expect, it } from 'vitest';
import { completionKey } from '@/lib/keys';
import { keyBetween } from '@/lib/order';
import type { HabibitState } from '@/lib/types';
import { habibitReducer, initialState, stamp, type HabibitIntent } from './reducer';
import { activeHabits, completedCount, isCompleted, sortedTasks } from './selectors';

/*
 * A fake clock and id generator, so every test is deterministic: each action is
 * one second after the last, and ids are id-1, id-2, …
 */
let seconds = 0;
let ids = 0;
beforeEach(() => {
  seconds = 0;
  ids = 0;
});
const nextTime = () => new Date(Date.UTC(2026, 8, 16, 0, 0, seconds++));
const nextId = () => `id-${++ids}`;
const T = (s: number) => new Date(Date.UTC(2026, 8, 16, 0, 0, s)).toISOString();

/** Stamps each intent like the provider does, then applies them in order. */
function run(intents: HabibitIntent[], from: HabibitState = initialState): HabibitState {
  return intents.reduce((state, intent) => habibitReducer(state, stamp(intent, nextTime(), nextId)), from);
}

const DAY_A = '2026-09-07';
const DAY_B = '2026-09-08';

describe('stamp', () => {
  it('adds the time to every intent, and an id only to adds', () => {
    const now = new Date('2026-09-16T04:00:00.000Z');
    expect(stamp({ type: 'ADD_HABIT', title: 'Water' }, now, () => 'new')).toEqual({
      type: 'ADD_HABIT',
      title: 'Water',
      id: 'new',
      at: '2026-09-16T04:00:00.000Z',
    });
    expect(stamp({ type: 'REMOVE_HABIT', id: 'h1' }, now, () => 'unused')).toEqual({
      type: 'REMOVE_HABIT',
      id: 'h1',
      at: '2026-09-16T04:00:00.000Z',
    });
  });

  it('keeps the target id of a rename or delete, rather than replacing it', () => {
    expect(stamp({ type: 'RENAME_TASK', id: 't1', title: 'x' }, new Date(), () => 'wrong')).toMatchObject({ id: 't1' });
  });

  it('defaults to the real clock and a real UUID', () => {
    const action = stamp({ type: 'ADD_TASK', title: 'x' });
    expect(action.at).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
    expect('id' in action && action.id).toMatch(/^[0-9a-f-]{36}$/);
  });
});

describe('habits', () => {
  it('adds a habit with the stamped id and time, and a trimmed title', () => {
    const state = run([{ type: 'ADD_HABIT', title: '  Drink water  ' }]);

    expect(state.habits).toEqual([
      {
        id: 'id-1',
        title: 'Drink water',
        createdAt: T(0),
        updatedAt: T(0),
        archivedAt: null,
        deletedAt: null,
        // The first habit of an empty list gets the first key.
        position: keyBetween(null, null),
      },
    ]);
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

  it('ignores removal of an unknown habit', () => {
    const state = run([{ type: 'ADD_HABIT', title: 'Water' }]);
    expect(run([{ type: 'REMOVE_HABIT', id: 'nope' }], state)).toBe(state);
  });
});

describe('deleting leaves a tombstone', () => {
  it('keeps a deleted habit as a row with deletedAt and updatedAt set', () => {
    const state = run([
      { type: 'ADD_HABIT', title: 'Water' },
      { type: 'REMOVE_HABIT', id: 'id-1' },
    ]);

    expect(state.habits).toHaveLength(1);
    expect(state.habits[0]).toMatchObject({ id: 'id-1', deletedAt: T(1), updatedAt: T(1) });
  });

  it('hides a deleted habit from the UI and from the daily count', () => {
    const state = run([
      { type: 'ADD_HABIT', title: 'Water' },
      { type: 'ADD_HABIT', title: 'Read' },
      { type: 'TOGGLE_COMPLETION', habitId: 'id-1', dateKey: DAY_A },
      { type: 'TOGGLE_COMPLETION', habitId: 'id-2', dateKey: DAY_A },
      { type: 'REMOVE_HABIT', id: 'id-1' },
    ]);

    expect(activeHabits(state).map((h) => h.title)).toEqual(['Read']);
    expect(completedCount(state, DAY_A)).toBe(1);
  });

  it('leaves the deleted habit\'s completions in place, so they can still sync', () => {
    const state = run([
      { type: 'ADD_HABIT', title: 'Water' },
      { type: 'TOGGLE_COMPLETION', habitId: 'id-1', dateKey: DAY_A },
      { type: 'REMOVE_HABIT', id: 'id-1' },
    ]);
    expect(state.completions[completionKey('id-1', DAY_A)]).toEqual({ done: true, updatedAt: T(1) });
  });

  it('deleting twice changes nothing the second time, so the first delete time is kept', () => {
    const once = run([
      { type: 'ADD_HABIT', title: 'Water' },
      { type: 'REMOVE_HABIT', id: 'id-1' },
    ]);
    expect(run([{ type: 'REMOVE_HABIT', id: 'id-1' }], once)).toBe(once);
  });

  it('a deleted habit cannot be renamed or ticked back to life', () => {
    const deleted = run([
      { type: 'ADD_HABIT', title: 'Water' },
      { type: 'REMOVE_HABIT', id: 'id-1' },
    ]);
    expect(run([{ type: 'RENAME_HABIT', id: 'id-1', title: 'Zombie' }], deleted)).toBe(deleted);
    expect(run([{ type: 'TOGGLE_COMPLETION', habitId: 'id-1', dateKey: DAY_A }], deleted)).toBe(deleted);
  });

  it('keeps a deleted task as a tombstone, hidden from the list', () => {
    const state = run([
      { type: 'ADD_TASK', title: 'One' },
      { type: 'ADD_TASK', title: 'Two' },
      { type: 'REMOVE_TASK', id: 'id-1' },
    ]);

    expect(state.tasks[0]).toMatchObject({ id: 'id-1', deletedAt: T(2), updatedAt: T(2) });
    expect(sortedTasks(state).map((t) => t.title)).toEqual(['Two']);
  });

  it('a deleted task cannot be toggled, renamed or deleted again', () => {
    const deleted = run([
      { type: 'ADD_TASK', title: 'One' },
      { type: 'REMOVE_TASK', id: 'id-1' },
    ]);
    expect(run([{ type: 'TOGGLE_TASK', id: 'id-1' }], deleted)).toBe(deleted);
    expect(run([{ type: 'RENAME_TASK', id: 'id-1', title: 'Zombie' }], deleted)).toBe(deleted);
    expect(run([{ type: 'REMOVE_TASK', id: 'id-1' }], deleted)).toBe(deleted);
  });
});

describe('completions', () => {
  it('ticking creates a done record dated by the action', () => {
    const state = run([
      { type: 'ADD_HABIT', title: 'Water' },
      { type: 'TOGGLE_COMPLETION', habitId: 'id-1', dateKey: DAY_A },
    ]);
    expect(state.completions).toEqual({ [completionKey('id-1', DAY_A)]: { done: true, updatedAt: T(1) } });
  });

  it('unticking keeps the record as done: false, so the untick can sync', () => {
    const state = run([
      { type: 'ADD_HABIT', title: 'Water' },
      { type: 'TOGGLE_COMPLETION', habitId: 'id-1', dateKey: DAY_A },
      { type: 'TOGGLE_COMPLETION', habitId: 'id-1', dateKey: DAY_A },
    ]);

    expect(isCompleted(state, 'id-1', DAY_A)).toBe(false);
    expect(state.completions[completionKey('id-1', DAY_A)]).toEqual({ done: false, updatedAt: T(2) });
  });

  it('ticking again after an untick reuses the same record', () => {
    const state = run([
      { type: 'ADD_HABIT', title: 'Water' },
      { type: 'TOGGLE_COMPLETION', habitId: 'id-1', dateKey: DAY_A },
      { type: 'TOGGLE_COMPLETION', habitId: 'id-1', dateKey: DAY_A },
      { type: 'TOGGLE_COMPLETION', habitId: 'id-1', dateKey: DAY_A },
    ]);
    expect(Object.keys(state.completions)).toHaveLength(1);
    expect(isCompleted(state, 'id-1', DAY_A)).toBe(true);
  });

  it('is scoped to a single day, which is what makes it a habit and not a task', () => {
    const state = run([
      { type: 'ADD_HABIT', title: 'Water' },
      { type: 'TOGGLE_COMPLETION', habitId: 'id-1', dateKey: DAY_A },
    ]);
    expect(isCompleted(state, 'id-1', DAY_A)).toBe(true);
    expect(isCompleted(state, 'id-1', DAY_B)).toBe(false);
  });

  it('toggles two same-titled habits independently', () => {
    const state = run([
      { type: 'ADD_HABIT', title: 'Stretch' },
      { type: 'ADD_HABIT', title: 'Stretch' },
      { type: 'TOGGLE_COMPLETION', habitId: 'id-1', dateKey: DAY_A },
    ]);
    expect(isCompleted(state, 'id-1', DAY_A)).toBe(true);
    expect(isCompleted(state, 'id-2', DAY_A)).toBe(false);
  });

  it('ignores a completion for an unknown habit', () => {
    const state = run([{ type: 'ADD_HABIT', title: 'Water' }]);
    expect(run([{ type: 'TOGGLE_COMPLETION', habitId: 'nope', dateKey: DAY_A }], state)).toBe(state);
  });

  it('counts completions per day for the section header', () => {
    const state = run([
      { type: 'ADD_HABIT', title: 'Water' },
      { type: 'ADD_HABIT', title: 'Read' },
      { type: 'ADD_HABIT', title: 'Stretch' },
      { type: 'TOGGLE_COMPLETION', habitId: 'id-1', dateKey: DAY_A },
      { type: 'TOGGLE_COMPLETION', habitId: 'id-2', dateKey: DAY_A },
    ]);
    expect(completedCount(state, DAY_A)).toBe(2);
    expect(completedCount(state, DAY_B)).toBe(0);
  });
});

describe('tasks', () => {
  it('adds, completes and reopens a task, stamping each change', () => {
    let state = run([{ type: 'ADD_TASK', title: '  Book dentist  ' }]);
    expect(state.tasks[0]).toEqual({
      id: 'id-1',
      title: 'Book dentist',
      createdAt: T(0),
      updatedAt: T(0),
      completedAt: null,
      deletedAt: null,
    });

    state = run([{ type: 'TOGGLE_TASK', id: 'id-1' }], state);
    expect(state.tasks[0]).toMatchObject({ completedAt: T(1), updatedAt: T(1) });

    state = run([{ type: 'TOGGLE_TASK', id: 'id-1' }], state);
    expect(state.tasks[0]).toMatchObject({ completedAt: null, updatedAt: T(2) });
  });

  it('ignores empty titles', () => {
    expect(run([{ type: 'ADD_TASK', title: '   ' }]).tasks).toHaveLength(0);
  });

  it('sinks completed tasks to the bottom while preserving order within groups', () => {
    const state = run([
      { type: 'ADD_TASK', title: 'One' },
      { type: 'ADD_TASK', title: 'Two' },
      { type: 'ADD_TASK', title: 'Three' },
      { type: 'TOGGLE_TASK', id: 'id-1' },
    ]);
    expect(sortedTasks(state).map((t) => t.title)).toEqual(['Two', 'Three', 'One']);
  });

  it('does not touch habits when a task is toggled', () => {
    let state = run([
      { type: 'ADD_HABIT', title: 'Water' },
      { type: 'ADD_TASK', title: 'Book dentist' },
    ]);
    const habitsBefore = state.habits;

    state = run([{ type: 'TOGGLE_TASK', id: 'id-2' }], state);

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

    // Every kind of write, each applied directly to the same original state.
    const intents: HabibitIntent[] = [
      { type: 'ADD_HABIT', title: 'Read' },
      { type: 'TOGGLE_COMPLETION', habitId: 'id-1', dateKey: DAY_A },
      { type: 'RENAME_HABIT', id: 'id-1', title: 'Juice' },
      { type: 'REMOVE_HABIT', id: 'id-1' },
      { type: 'TOGGLE_TASK', id: 'id-2' },
      { type: 'RENAME_TASK', id: 'id-2', title: 'Dentist' },
      { type: 'REMOVE_TASK', id: 'id-2' },
    ];
    for (const intent of intents) habibitReducer(state, stamp(intent, nextTime(), nextId));

    expect(state).toEqual(snapshot);
  });

  it('returns the same reference when nothing changed', () => {
    const state = run([{ type: 'ADD_HABIT', title: 'Water' }]);
    expect(run([{ type: 'ADD_HABIT', title: '  ' }], state)).toBe(state);
  });

  it('⭐ is deterministic: the same action on the same state gives the same result', () => {
    // What lets an action be retried, replayed, or run twice by StrictMode.
    const state = run([{ type: 'ADD_HABIT', title: 'Water' }]);
    const action = stamp({ type: 'ADD_HABIT', title: 'Read' }, new Date(T(9)), () => 'fixed');

    expect(habibitReducer(state, action)).toEqual(habibitReducer(state, action));
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
    const toggled = run([{ type: 'TOGGLE_COMPLETION', habitId: 'id-1', dateKey: DAY_A }], restored);
    expect(isCompleted(toggled, 'id-1', DAY_A)).toBe(true);
  });
});

describe('RENAME_HABIT', () => {
  it('changes the title, trims it, and stamps updatedAt', () => {
    const state = run([
      { type: 'ADD_HABIT', title: 'Drink watr' },
      { type: 'RENAME_HABIT', id: 'id-1', title: '  Drink water  ' },
    ]);
    expect(state.habits[0]).toMatchObject({
      id: 'id-1',
      title: 'Drink water',
      createdAt: T(0),
      updatedAt: T(1),
    });
  });

  it('keeps the whole completion history — the reason ids exist', () => {
    let state = run([
      { type: 'ADD_HABIT', title: 'Drink watr' },
      { type: 'TOGGLE_COMPLETION', habitId: 'id-1', dateKey: DAY_A },
      { type: 'TOGGLE_COMPLETION', habitId: 'id-1', dateKey: DAY_B },
    ]);
    const historyBefore = state.completions;

    state = run([{ type: 'RENAME_HABIT', id: 'id-1', title: 'Drink water' }], state);

    expect(state.completions).toBe(historyBefore);
    expect(isCompleted(state, 'id-1', DAY_A)).toBe(true);
    expect(isCompleted(state, 'id-1', DAY_B)).toBe(true);
  });

  it('rejects an empty or whitespace-only title instead of deleting', () => {
    const state = run([{ type: 'ADD_HABIT', title: 'Stretch' }]);
    expect(run([{ type: 'RENAME_HABIT', id: 'id-1', title: '' }], state)).toBe(state);
    expect(run([{ type: 'RENAME_HABIT', id: 'id-1', title: '   ' }], state)).toBe(state);
  });

  it('returns the same state, with no new updatedAt, when the title does not actually change', () => {
    const state = run([{ type: 'ADD_HABIT', title: 'Stretch' }]);
    expect(run([{ type: 'RENAME_HABIT', id: 'id-1', title: ' Stretch ' }], state)).toBe(state);
  });

  it('ignores an unknown id', () => {
    const state = run([{ type: 'ADD_HABIT', title: 'Stretch' }]);
    expect(run([{ type: 'RENAME_HABIT', id: 'nope', title: 'X' }], state)).toBe(state);
  });

  it('renames only the named habit, even when titles collide, and stamps only that one', () => {
    const state = run([
      { type: 'ADD_HABIT', title: 'Stretch' },
      { type: 'ADD_HABIT', title: 'Stretch' },
      { type: 'RENAME_HABIT', id: 'id-2', title: 'Yoga' },
    ]);
    expect(state.habits[0]).toMatchObject({ title: 'Stretch', updatedAt: T(0) });
    expect(state.habits[1]).toMatchObject({ title: 'Yoga', updatedAt: T(2) });
  });
});

describe('RENAME_TASK', () => {
  it('changes the title, stamps updatedAt, and keeps it done if it was done', () => {
    const state = run([
      { type: 'ADD_TASK', title: 'Book dentst' },
      { type: 'TOGGLE_TASK', id: 'id-1' },
      { type: 'RENAME_TASK', id: 'id-1', title: 'Book dentist' },
    ]);
    expect(state.tasks[0]).toMatchObject({ title: 'Book dentist', completedAt: T(1), updatedAt: T(2) });
  });

  it('rejects an empty title', () => {
    const state = run([{ type: 'ADD_TASK', title: 'Pay rent' }]);
    expect(run([{ type: 'RENAME_TASK', id: 'id-1', title: '  ' }], state)).toBe(state);
  });

  it('does not touch habits', () => {
    let state = run([
      { type: 'ADD_HABIT', title: 'Water' },
      { type: 'ADD_TASK', title: 'Pay rent' },
    ]);
    const habitsBefore = state.habits;
    state = run([{ type: 'RENAME_TASK', id: 'id-2', title: 'Pay rent!' }], state);
    expect(state.habits).toBe(habitsBefore);
  });
});
