import { afterEach, describe, expect, it } from 'vitest';
import { loadState, saveState, STORAGE_KEY } from '@/lib/storage';
import { DAILY, parseSchedule, timesAWeek, weekdays } from '@/lib/schedule';
import { changesToPush } from '@/lib/sync/merge';
import { habitToRow, rowToHabit } from '@/lib/sync/rows';
import { touchedBy } from '@/lib/sync/sync';
import type { HabibitState } from '@/lib/types';
import { habibitReducer, initialState, stamp, type HabibitIntent } from './reducer';

/*
 * v4 Block B: a schedule on a habit — stored, kept, and sent to the account.
 *
 * The rule that runs through all of it: a schedule written by a **newer** build
 * must pass through this one untouched. A phone can run the version it last
 * loaded for days, and if this build rewrote what it cannot read as "every
 * day", the next rename or tick made here would upload that and erase the
 * choice everywhere.
 */

const at = (iso: string) => new Date(iso);
const WHEN = '2026-09-30T08:00:00.000Z';
const LATER = '2026-09-30T09:00:00.000Z';

function apply(state: HabibitState, intent: HabibitIntent, when = WHEN, id = 'h1'): HabibitState {
  return habibitReducer(state, stamp(intent, at(when), () => id));
}

function oneHabit(): HabibitState {
  return apply(initialState, { type: 'ADD_HABIT', title: 'Water' });
}

const scheduleOf = (state: HabibitState, id = 'h1') => state.habits.find((h) => h.id === id)!.schedule;

describe('setting a habit’s schedule', () => {
  it('V4B-30 · ⭐ a habit starts as every day', () => {
    // The promise that nobody's list changes when this ships.
    expect(scheduleOf(oneHabit())).toBeNull();
    expect(parseSchedule(scheduleOf(oneHabit()))).toEqual(DAILY);
  });

  it('V4B-31 · ⭐ choosing days stores them, and counts as an edit', () => {
    const set = apply(oneHabit(), { type: 'SET_SCHEDULE', id: 'h1', schedule: weekdays([0, 2, 4]) }, LATER);

    expect(scheduleOf(set)).toBe('weekdays:0,2,4');
    expect(set.habits[0].updatedAt).toBe(LATER);
  });

  it('V4B-32 · ⭐ going back to every day clears it rather than storing "daily"', () => {
    // One representation of every day, so a habit from before v4 and one set
    // back to daily are the same row and never look like an edit of each other.
    let state = apply(oneHabit(), { type: 'SET_SCHEDULE', id: 'h1', schedule: timesAWeek(3) }, LATER);
    state = apply(state, { type: 'SET_SCHEDULE', id: 'h1', schedule: DAILY }, LATER);

    expect(scheduleOf(state)).toBeNull();
  });

  it('V4B-33 · ⭐ choosing the schedule it already has changes nothing', () => {
    // It would otherwise bump updatedAt, upload the row, and beat a real change
    // made on another device at the same time.
    const set = apply(oneHabit(), { type: 'SET_SCHEDULE', id: 'h1', schedule: weekdays([0, 2, 4]) }, LATER);
    const again = apply(set, { type: 'SET_SCHEDULE', id: 'h1', schedule: weekdays([4, 2, 0]) }, '2026-10-01T08:00:00.000Z');

    expect(again).toBe(set);
  });

  it('V4B-34 · a deleted habit cannot be given a schedule', () => {
    const deleted = apply(oneHabit(), { type: 'REMOVE_HABIT', id: 'h1' }, LATER);
    const after = apply(deleted, { type: 'SET_SCHEDULE', id: 'h1', schedule: weekdays([0]) }, LATER);

    expect(after).toBe(deleted);
    expect(apply(oneHabit(), { type: 'SET_SCHEDULE', id: 'nope', schedule: weekdays([0]) })).toEqual(oneHabit());
  });

  it('V4B-35 · ⭐ a schedule change is sent to the account', () => {
    const action = stamp({ type: 'SET_SCHEDULE', id: 'h1', schedule: weekdays([0]) }, at(WHEN));
    expect(touchedBy(action)).toBe('habit:h1');
  });
});

describe('a schedule on the device, and on the way to the account', () => {
  /** A minimal in-memory Storage, as in lib/storage.test.ts: no jsdom needed. */
  function installStorage(): Storage {
    const map = new Map<string, string>();
    const store = {
      get length() {
        return map.size;
      },
      key: (i: number) => [...map.keys()][i] ?? null,
      getItem: (k: string) => map.get(k) ?? null,
      setItem: (k: string, v: string) => void map.set(k, String(v)),
      removeItem: (k: string) => void map.delete(k),
      clear: () => map.clear(),
    } satisfies Storage;
    Object.defineProperty(globalThis, 'localStorage', { value: store, configurable: true, writable: true });
    return store;
  }

  afterEach(() =>
    Object.defineProperty(globalThis, 'localStorage', { value: undefined, configurable: true, writable: true }),
  );

  it('V4B-36 · ⭐ a schedule is still there after a reload', () => {
    installStorage();
    const state = apply(oneHabit(), { type: 'SET_SCHEDULE', id: 'h1', schedule: weekdays([0, 2, 4]) }, LATER);

    expect(saveState(state)).toBe(true);
    expect(scheduleOf(loadState()!)).toBe('weekdays:0,2,4');
  });

  it('V4B-37 · ⭐ a schedule from a newer build survives a reload here, unchanged', () => {
    installStorage();
    const habit = oneHabit().habits[0];
    saveState({ habits: [{ ...habit, schedule: 'every:3d' }], tasks: [], completions: {} });

    const loaded = loadState()!;
    expect(scheduleOf(loaded)).toBe('every:3d');
    // …and it behaves as every day while it is here, rather than hiding the habit.
    expect(parseSchedule(scheduleOf(loaded))).toEqual(DAILY);
  });

  it('V4B-38 · habits saved before v4 have no schedule, and read as every day', () => {
    const store = installStorage();
    const habit = oneHabit().habits[0];
    const withoutSchedule: Record<string, unknown> = { ...habit };
    delete withoutSchedule.schedule;
    store.setItem(
      STORAGE_KEY,
      JSON.stringify({ version: 2, state: { habits: [withoutSchedule], tasks: [], completions: {} } }),
    );

    expect(scheduleOf(loadState()!)).toBeNull();
  });

  it('V4B-39 · ⭐ a schedule the app cannot read still round-trips through the account', () => {
    const habit = { ...oneHabit().habits[0], schedule: 'every:3d' };
    expect(rowToHabit(habitToRow(habit))).toEqual(habit);
  });

  it('V4B-40 · a stored value that is not a schedule at all is dropped', () => {
    const habit = oneHabit().habits[0];
    expect(rowToHabit({ ...habitToRow(habit), schedule: 'DROP TABLE habits' }).schedule).toBeNull();
    expect(rowToHabit({ ...habitToRow(habit), schedule: 'x'.repeat(100) }).schedule).toBeNull();
  });

  it('V4B-41 · ⭐ a habit read back from the account is not uploaded again', () => {
    // Records are compared as text to decide what to upload. If the schedule
    // field survived the round trip in any other shape, every sync would
    // re-upload every habit, for ever (the v3 Block B bug, in a new place).
    const state = apply(oneHabit(), { type: 'SET_SCHEDULE', id: 'h1', schedule: weekdays([0, 2, 4]) }, LATER);
    const account: HabibitState = { ...state, habits: state.habits.map((h) => rowToHabit(habitToRow(h))) };

    expect(changesToPush(state, account).habits).toEqual([]);
  });
});
