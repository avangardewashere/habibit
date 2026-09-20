import { beforeEach, describe, expect, it } from 'vitest';
import { completionKey } from '@/lib/keys';
import { isOrderKey } from '@/lib/order';
import { mergeStates } from '@/lib/sync/merge';
import type { Habit, HabibitState } from '@/lib/types';
import { habibitReducer, initialState, stamp, type HabibitIntent } from './reducer';
import {
  activeHabits,
  archivedHabits,
  compareHabits,
  completedCount,
  currentStreak,
  liveHabits,
} from './selectors';

/* The same fake clock and ids as reducer.test.ts: one second apart, id-1, id-2, … */
let seconds = 0;
let ids = 0;
beforeEach(() => {
  seconds = 0;
  ids = 0;
});
const nextTime = () => new Date(Date.UTC(2026, 8, 20, 0, 0, seconds++));
const nextId = () => `id-${++ids}`;

function run(intents: HabibitIntent[], from: HabibitState = initialState): HabibitState {
  return intents.reduce((state, intent) => habibitReducer(state, stamp(intent, nextTime(), nextId)), from);
}

const titles = (habits: Habit[]) => habits.map((h) => h.title);
const add = (...names: string[]): HabibitIntent[] => names.map((title) => ({ type: 'ADD_HABIT', title }));
const idOf = (state: HabibitState, title: string) => state.habits.find((h) => h.title === title)!.id;

/** Habits as a pre-v3 build saved them: no positions, listed oldest first. */
function preV3(...names: string[]): HabibitState {
  return {
    ...initialState,
    habits: names.map((title, i) => ({
      id: `old-${i}`,
      title,
      createdAt: new Date(Date.UTC(2026, 0, 1, 0, 0, i)).toISOString(),
      updatedAt: new Date(Date.UTC(2026, 0, 1, 0, 0, i)).toISOString(),
      archivedAt: null,
      deletedAt: null,
      position: null,
    })),
  };
}

describe('the order habits are listed in', () => {
  it('V3B-10 · new habits go at the end, each with its own key', () => {
    const state = run(add('Water', 'Stretch', 'Read'));
    expect(titles(activeHabits(state))).toEqual(['Water', 'Stretch', 'Read']);
    expect(state.habits.every((h) => isOrderKey(h.position))).toBe(true);
  });

  it('V3B-11 · ⭐ moving a habit rewrites only that habit', () => {
    const before = run(add('Water', 'Stretch', 'Read', 'Walk'));
    const walk = idOf(before, 'Walk');

    const after = run([{ type: 'MOVE_HABIT', id: walk, toIndex: 0 }], before);

    expect(titles(activeHabits(after))).toEqual(['Walk', 'Water', 'Stretch', 'Read']);
    const changed = after.habits.filter((h, i) => h !== before.habits[i]);
    expect(changed.map((h) => h.title)).toEqual(['Walk']);
  });

  it('moves down, into the middle, and to the very end', () => {
    let state = run(add('A', 'B', 'C', 'D'));
    state = run([{ type: 'MOVE_HABIT', id: idOf(state, 'A'), toIndex: 2 }], state);
    expect(titles(activeHabits(state))).toEqual(['B', 'C', 'A', 'D']);
    state = run([{ type: 'MOVE_HABIT', id: idOf(state, 'B'), toIndex: 3 }], state);
    expect(titles(activeHabits(state))).toEqual(['C', 'A', 'D', 'B']);
  });

  it('V3B-12 · habits from before v3 keep their order until the first move, which then keys them all', () => {
    const old = preV3('Water', 'Stretch', 'Read');
    expect(titles(activeHabits(old))).toEqual(['Water', 'Stretch', 'Read']);

    // Added while the older ones have no position: it has none either, and still lands last.
    const withNew = run(add('Walk'), old);
    expect(withNew.habits.at(-1)!.position).toBeNull();
    expect(titles(activeHabits(withNew))).toEqual(['Water', 'Stretch', 'Read', 'Walk']);

    const moved = run([{ type: 'MOVE_HABIT', id: 'old-2', toIndex: 0 }], withNew);
    expect(titles(activeHabits(moved))).toEqual(['Read', 'Water', 'Stretch', 'Walk']);
    expect(moved.habits.every((h) => isOrderKey(h.position))).toBe(true);
  });

  it('V3B-13 · dropping a habit between two that share a key (two devices, same spot) still works', () => {
    let state = run(add('A', 'B', 'C'));
    // As if another device had inserted "C" at exactly the spot "B" took. Harmless on
    // its own (the tie is broken by age), but there's no key strictly between them.
    state = {
      ...state,
      habits: state.habits.map((h) => (h.title === 'C' ? { ...h, position: state.habits[1].position } : h)),
    };
    expect(titles(activeHabits(state))).toEqual(['A', 'B', 'C']);

    state = run([{ type: 'MOVE_HABIT', id: idOf(state, 'A'), toIndex: 1 }], state);

    expect(titles(activeHabits(state))).toEqual(['B', 'A', 'C']);
    const keys = activeHabits(state).map((h) => h.position!);
    expect(new Set(keys).size).toBe(3);
    expect([...keys].sort()).toEqual(keys);
  });

  it('V3B-14 · ignores moves that make no sense, and clamps ones past either end', () => {
    const state = run(add('A', 'B', 'C'));
    const a = idOf(state, 'A');
    const same = (intent: HabibitIntent) => expect(run([intent], state)).toBe(state);

    same({ type: 'MOVE_HABIT', id: 'nope', toIndex: 1 });
    same({ type: 'MOVE_HABIT', id: a, toIndex: 0 });
    same({ type: 'MOVE_HABIT', id: a, toIndex: Number.NaN });
    same({ type: 'MOVE_HABIT', id: a, toIndex: -5 });

    expect(titles(activeHabits(run([{ type: 'MOVE_HABIT', id: a, toIndex: 99 }], state)))).toEqual(['B', 'C', 'A']);

    const archived = run([{ type: 'ARCHIVE_HABIT', id: a }], state);
    expect(run([{ type: 'MOVE_HABIT', id: a, toIndex: 1 }], archived)).toBe(archived);
    const deleted = run([{ type: 'REMOVE_HABIT', id: a }], state);
    expect(run([{ type: 'MOVE_HABIT', id: a, toIndex: 1 }], deleted)).toBe(deleted);
  });

  it('V3B-17 · ⭐ two devices reordering at once end in an order that keeps both moves', () => {
    /*
     * The reason positions are keys and not 1, 2, 3. Both devices start from the
     * same list. The phone moves Walk to the top; the PC moves Water to the bottom.
     * With numbers, each would renumber every habit and "latest change wins" per
     * habit would mix the two numberings. With keys, each move touched one habit,
     * so combining them keeps both.
     */
    const base = run(add('Water', 'Stretch', 'Read', 'Walk'));
    const phone = run([{ type: 'MOVE_HABIT', id: idOf(base, 'Walk'), toIndex: 0 }], base);
    const pc = run([{ type: 'MOVE_HABIT', id: idOf(base, 'Water'), toIndex: 3 }], base);

    const merged = mergeStates(phone, pc);
    expect(titles(activeHabits(merged))).toEqual(['Walk', 'Stretch', 'Read', 'Water']);
    expect(titles(activeHabits(mergeStates(pc, phone)))).toEqual(titles(activeHabits(merged)));
  });
});

describe('compareHabits', () => {
  const habit = (id: string, position: string | null, second = 0): Habit => ({
    id,
    title: id,
    createdAt: new Date(Date.UTC(2026, 0, 1, 0, 0, second)).toISOString(),
    updatedAt: new Date(Date.UTC(2026, 0, 1, 0, 0, second)).toISOString(),
    archivedAt: null,
    deletedAt: null,
    position,
  });

  it('V3B-18 · keys first (by character code), then unpositioned oldest first, then by id', () => {
    const sorted = [
      habit('late-null', null, 9),
      habit('lower-a', 'a'),
      habit('early-null', null, 1),
      habit('upper-B', 'B'),
      habit('same-2', 'V'),
      habit('same-1', 'V'),
    ].sort(compareHabits);
    expect(sorted.map((h) => h.id)).toEqual(['upper-B', 'same-1', 'same-2', 'lower-a', 'early-null', 'late-null']);
  });
});

describe('archiving', () => {
  const TODAY = '2026-09-20';

  it('V3B-15 · ⭐ archive hides a habit; unarchive brings it back in place with its streak', () => {
    let state = run(add('Water', 'Stretch', 'Read'));
    const stretch = idOf(state, 'Stretch');
    for (const day of ['2026-09-18', '2026-09-19', TODAY]) {
      state = run([{ type: 'TOGGLE_COMPLETION', habitId: stretch, dateKey: day }], state);
    }
    expect(currentStreak(state, stretch, TODAY)).toBe(3);
    expect(completedCount(state, TODAY)).toBe(1);

    state = run([{ type: 'ARCHIVE_HABIT', id: stretch }], state);
    expect(titles(activeHabits(state))).toEqual(['Water', 'Read']);
    expect(titles(archivedHabits(state))).toEqual(['Stretch']);
    // Hidden habits don't count towards today's "done of total".
    expect(completedCount(state, TODAY)).toBe(0);

    state = run([{ type: 'UNARCHIVE_HABIT', id: stretch }], state);
    expect(titles(activeHabits(state))).toEqual(['Water', 'Stretch', 'Read']);
    expect(currentStreak(state, stretch, TODAY)).toBe(3);
    expect(state.completions[completionKey(stretch, TODAY)]?.done).toBe(true);
  });

  it('V3B-16 · archiving twice, or a deleted habit, changes nothing', () => {
    const state = run(add('Water'));
    const water = idOf(state, 'Water');
    const archived = run([{ type: 'ARCHIVE_HABIT', id: water }], state);

    expect(run([{ type: 'ARCHIVE_HABIT', id: water }], archived)).toBe(archived);
    expect(run([{ type: 'UNARCHIVE_HABIT', id: water }], state)).toBe(state);

    const deleted = run([{ type: 'REMOVE_HABIT', id: water }], archived);
    expect(run([{ type: 'UNARCHIVE_HABIT', id: water }], deleted)).toBe(deleted);
    expect(liveHabits(deleted)).toEqual([]);
  });

  it('archiving and moving never disturb each other', () => {
    let state = run(add('A', 'B', 'C', 'D'));
    state = run([{ type: 'ARCHIVE_HABIT', id: idOf(state, 'B') }], state);
    state = run([{ type: 'MOVE_HABIT', id: idOf(state, 'D'), toIndex: 0 }], state);
    expect(titles(activeHabits(state))).toEqual(['D', 'A', 'C']);
    state = run([{ type: 'UNARCHIVE_HABIT', id: idOf(state, 'B') }], state);
    expect(titles(activeHabits(state))).toEqual(['D', 'A', 'B', 'C']);
  });
});
