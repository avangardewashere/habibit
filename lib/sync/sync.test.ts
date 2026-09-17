import { describe, expect, it } from 'vitest';
import type { Habit, HabibitState } from '@/lib/types';
import { mergeStates, type Changes } from './merge';
import type { RemoteStore } from './remote';
import { completionToRow, habitToRow, rowToCompletion, rowToHabit } from './rows';
import { syncOnce } from './sync';

const T = (minute: number) => new Date(Date.UTC(2026, 8, 17, 8, minute)).toISOString();
const habit = (id: string, title: string, updated = 0): Habit => ({
  id,
  title,
  createdAt: T(0),
  updatedAt: T(updated),
  archivedAt: null,
  deletedAt: null,
});
const empty = (): HabibitState => ({ habits: [], tasks: [], completions: {} });

/** An in-memory account. `failPush` / `failPull` simulate the network dropping. */
function fakeRemote(initial: HabibitState = empty(), options: { failPull?: boolean; failPushAfter?: number } = {}) {
  let stored = structuredClone(initial);
  let pushes = 0;
  const store: RemoteStore & { stored: () => HabibitState; pushes: () => number; heal: () => void } = {
    async pull() {
      if (options.failPull) throw new Error('offline');
      return structuredClone(stored);
    },
    async push(changes: Changes) {
      pushes += 1;
      // Store part of the upload, then fail: the worst kind of interruption.
      const limit = options.failPushAfter;
      const habits = limit === undefined ? changes.habits : changes.habits.slice(0, limit);
      stored = mergeStates(stored, { habits, tasks: [], completions: {} });
      if (limit !== undefined) throw new Error('connection lost halfway');
      stored = mergeStates(stored, {
        habits: [],
        tasks: changes.tasks,
        completions: Object.fromEntries(changes.completions),
      });
    },
    stored: () => stored,
    pushes: () => pushes,
    heal: () => {
      options = {};
    },
  };
  return store;
}

describe('V2D: the first sign-in, against a fake account', () => {
  const phone: HabibitState = {
    habits: [habit('h-phone', 'Drink water')],
    tasks: [],
    completions: { 'h-phone::2026-09-17': { done: true, updatedAt: T(1) } },
  };

  it('V2D-20 · empty device, account with data → the device receives it', async () => {
    const remote = fakeRemote(phone);
    const { merged, uploaded } = await syncOnce(empty(), remote);
    expect(merged).toEqual(phone);
    expect(uploaded).toBe(0);
  });

  it('V2D-21 · ⭐ device with data, EMPTY account → everything uploaded, device keeps it', async () => {
    const remote = fakeRemote();
    const { merged, uploaded } = await syncOnce(phone, remote);
    expect(merged).toEqual(phone);
    expect(remote.stored()).toEqual(phone);
    expect(uploaded).toBe(2);
  });

  it('V2D-22 · both have data → both end up with everything', async () => {
    const account: HabibitState = { habits: [habit('h-pc', 'Stretch')], tasks: [], completions: {} };
    const remote = fakeRemote(account);
    const { merged } = await syncOnce(phone, remote);
    expect(merged.habits.map((h) => h.id).sort()).toEqual(['h-pc', 'h-phone']);
    expect(remote.stored()).toEqual(merged);
  });

  it('V2D-23 · ⭐ the connection drops before anything is read → throws, and hands back nothing to apply', async () => {
    const remote = fakeRemote(empty(), { failPull: true });
    await expect(syncOnce(phone, remote)).rejects.toThrow('offline');
    expect(remote.pushes()).toBe(0);
  });

  it('V2D-24 · ⭐ the connection drops halfway through uploading → throws; retrying finishes the job', async () => {
    const many: HabibitState = {
      habits: [habit('a', 'A'), habit('b', 'B'), habit('c', 'C')],
      tasks: [],
      completions: { 'a::2026-09-17': { done: true, updatedAt: T(1) } },
    };
    const remote = fakeRemote(empty(), { failPushAfter: 1 });

    await expect(syncOnce(many, remote)).rejects.toThrow('halfway');
    expect(remote.stored().habits).toHaveLength(1); // partly uploaded

    remote.heal();
    const { merged } = await syncOnce(many, remote);
    expect(merged).toEqual(many);
    expect(remote.stored()).toEqual(many);
  });

  it('V2D-25 · syncing again straight away uploads nothing', async () => {
    const remote = fakeRemote();
    const { merged } = await syncOnce(phone, remote);
    const again = await syncOnce(merged, remote);
    expect(again.uploaded).toBe(0);
    expect(remote.pushes()).toBe(1);
  });
});

describe('rows: the database shape', () => {
  it('V2D-26 · a habit survives the round trip unchanged, even with Postgres’s own time format', () => {
    const h = { ...habit('h', 'Drink water', 5), deletedAt: T(6) };
    const fromDatabase = {
      ...habitToRow(h),
      updated_at: '2026-09-17 08:05:00+00',
      deleted_at: '2026-09-17T16:06:00+08:00',
    };
    expect(rowToHabit(fromDatabase)).toEqual(h);
  });

  it('V2D-27 · a completion key splits into habit id and day, and back', () => {
    const row = completionToRow('9b2c-uuid::2026-09-17', { done: false, updatedAt: T(3) });
    expect(row).toEqual({ habit_id: '9b2c-uuid', day: '2026-09-17', done: false, updated_at: T(3) });
    expect(rowToCompletion(row)).toEqual(['9b2c-uuid::2026-09-17', { done: false, updatedAt: T(3) }]);
  });
});
