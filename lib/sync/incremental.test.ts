import { describe, expect, it } from 'vitest';
import { habibitReducer, initialState, stamp, type HabibitIntent } from '@/store/reducer';
import { activeHabits, isCompleted } from '@/store/selectors';
import { fakeAccount } from '@/test-support/fake-account';
import type { HabibitState } from '@/lib/types';
import { mergeStates } from './merge';
import { changeCount, collectChanges, outboxKeysFor, syncChanges, touchedBy, type OutboxKey } from './sync';

const DAY = '2026-09-18';

/**
 * A simulated device: its own data, outbox and cursor, doing exactly what
 * SyncProvider does. Each device has its own clock, so "who edited last" is
 * under the test's control.
 */
function device(account: ReturnType<typeof fakeAccount>, name: string) {
  let state: HabibitState = initialState;
  const outbox = new Map<OutboxKey, true>();
  let cursor: string | null = null;
  let minute = 0;
  let nextId = 0;

  return {
    name,
    /** Makes an edit at this device's clock time, and records it in the outbox. */
    edit(intent: HabibitIntent, at = minute++) {
      const action = stamp(intent, new Date(Date.UTC(2026, 8, 18, 9, at)), () => `${name}-${++nextId}`);
      state = habibitReducer(state, action);
      const key = touchedBy(action);
      if (key) outbox.set(key, true);
      return action;
    },
    async sync() {
      const result = await syncChanges(state, outbox.keys(), cursor, account.remote());
      // Exactly what SyncProvider does with a result.
      state = mergeStates(state, result.merged);
      cursor = result.cursor;
      for (const [key, updatedAt] of outboxKeysFor(result.pushed)) {
        const current = collectChanges(state, [key]);
        const now = current.habits[0]?.updatedAt ?? current.tasks[0]?.updatedAt ?? current.completions[0]?.[1].updatedAt;
        if (now === updatedAt) outbox.delete(key);
      }
      return result;
    },
    state: () => state,
    outbox: () => [...outbox.keys()],
    cursor: () => cursor,
    titles: () => activeHabits(state).map((h) => h.title),
    setClock: (m: number) => {
      minute = m;
    },
  };
}

function twoDevices() {
  const account = fakeAccount();
  return { account, phone: device(account, 'phone'), pc: device(account, 'pc') };
}

describe('the outbox', () => {
  it('V2E-01 · every kind of edit names the record it changed', () => {
    const at = '2026-09-18T09:00:00.000Z';
    const cases: [HabibitIntent, OutboxKey][] = [
      [{ type: 'REMOVE_HABIT', id: 'h1' }, 'habit:h1'],
      [{ type: 'RENAME_HABIT', id: 'h1', title: 'x' }, 'habit:h1'],
      [{ type: 'TOGGLE_COMPLETION', habitId: 'h1', dateKey: DAY }, `completion:h1::${DAY}`],
      [{ type: 'TOGGLE_TASK', id: 't1' }, 'task:t1'],
      [{ type: 'REMOVE_TASK', id: 't1' }, 'task:t1'],
      [{ type: 'RENAME_TASK', id: 't1', title: 'x' }, 'task:t1'],
    ];
    for (const [intent, key] of cases) expect(touchedBy(stamp(intent, new Date(at)))).toBe(key);
    expect(touchedBy(stamp({ type: 'ADD_HABIT', title: 'x' }, new Date(at), () => 'new'))).toBe('habit:new');
    expect(touchedBy(stamp({ type: 'ADD_TASK', title: 'x' }, new Date(at), () => 'new'))).toBe('task:new');
  });

  it('V2E-02 · syncing does not count as an edit, so pulled data is never sent straight back', () => {
    expect(touchedBy({ type: 'MERGE_REMOTE', state: initialState })).toBeNull();
    expect(touchedBy({ type: 'HYDRATE', state: initialState })).toBeNull();
    expect(touchedBy({ type: 'CLEAR_DEVICE' })).toBeNull();
  });

  it('V2E-03 · a successful sync empties the outbox', async () => {
    const { phone } = twoDevices();
    await phone.sync();
    phone.edit({ type: 'ADD_HABIT', title: 'Drink water' });
    expect(phone.outbox()).toHaveLength(1);
    await phone.sync();
    expect(phone.outbox()).toEqual([]);
  });

  it('V2E-04 · ⭐ a failed sync keeps the outbox, and the next one delivers it', async () => {
    const { account, phone, pc } = twoDevices();
    await phone.sync();
    await pc.sync();
    phone.edit({ type: 'ADD_HABIT', title: 'Offline habit' });

    account.setOffline(true);
    await expect(phone.sync()).rejects.toThrow('offline');
    expect(phone.outbox()).toHaveLength(1);

    account.setOffline(false);
    await phone.sync();
    await pc.sync();
    expect(pc.titles()).toEqual(['Offline habit']);
  });
});

describe('V2E: two devices, both open', () => {
  async function bothWith(title: string) {
    const setup = twoDevices();
    await setup.phone.sync();
    await setup.pc.sync();
    const add = setup.phone.edit({ type: 'ADD_HABIT', title });
    await setup.phone.sync();
    await setup.pc.sync();
    return { ...setup, id: add.type === 'ADD_HABIT' ? add.id : '' };
  }

  it('V2E-10 · an edit on one device reaches the other on its next small sync', async () => {
    const { pc } = await bothWith('Drink water');
    expect(pc.titles()).toEqual(['Drink water']);
  });

  it('V2E-11 · ⭐ both rename the same habit: the later rename wins on BOTH devices', async () => {
    const { phone, pc, id } = await bothWith('Drink watr');
    pc.setClock(30);
    phone.setClock(40);
    pc.edit({ type: 'RENAME_HABIT', id, title: 'PC name (earlier)' });
    phone.edit({ type: 'RENAME_HABIT', id, title: 'Phone name (later)' });

    // Deliberately the "wrong" order: the later edit uploads first.
    await phone.sync();
    await pc.sync();
    await phone.sync();

    expect(phone.titles()).toEqual(['Phone name (later)']);
    expect(pc.titles()).toEqual(['Phone name (later)']);
  });

  it('V2E-12 · ⭐ one device edits, the other deletes later: deleted on both', async () => {
    const { phone, pc, id } = await bothWith('Stretch');
    phone.setClock(30);
    pc.setClock(40);
    phone.edit({ type: 'RENAME_HABIT', id, title: 'Stretch more' });
    pc.edit({ type: 'REMOVE_HABIT', id });

    await pc.sync();
    await phone.sync();
    await pc.sync();

    expect(phone.titles()).toEqual([]);
    expect(pc.titles()).toEqual([]);
  });

  it('V2E-13 · …and a delete followed by a later edit elsewhere keeps the edit', async () => {
    const { phone, pc, id } = await bothWith('Stretch');
    pc.setClock(30);
    phone.setClock(40);
    pc.edit({ type: 'REMOVE_HABIT', id });
    // The phone hasn't heard about the delete, so its rename is of a live habit.
    phone.edit({ type: 'RENAME_HABIT', id, title: 'Stretch more' });

    await pc.sync();
    await phone.sync();
    await pc.sync();

    expect(phone.titles()).toEqual(['Stretch more']);
    expect(pc.titles()).toEqual(['Stretch more']);
  });

  it('V2E-14 · ⭐ ticked on the phone, unticked later on the PC: unticked on both', async () => {
    const { phone, pc, id } = await bothWith('Walk');
    phone.setClock(30);
    phone.edit({ type: 'TOGGLE_COMPLETION', habitId: id, dateKey: DAY });
    await phone.sync();
    await pc.sync();
    expect(isCompleted(pc.state(), id, DAY)).toBe(true);

    pc.setClock(40);
    pc.edit({ type: 'TOGGLE_COMPLETION', habitId: id, dateKey: DAY });
    await pc.sync();
    await phone.sync();

    expect(isCompleted(phone.state(), id, DAY)).toBe(false);
    expect(isCompleted(pc.state(), id, DAY)).toBe(false);
  });

  it('V2E-15 · ⭐ the same change delivered twice does no harm', async () => {
    const { account, phone, pc, id } = await bothWith('Read');
    phone.setClock(30);
    phone.edit({ type: 'RENAME_HABIT', id, title: 'Read 10 pages' });
    const outgoing = collectChanges(phone.state(), phone.outbox());

    await account.remote().push(outgoing);
    await account.remote().push(outgoing); // e.g. a retry after a lost reply
    await phone.sync();
    await pc.sync();

    expect(pc.titles()).toEqual(['Read 10 pages']);
    expect(account.snapshot().habits).toHaveLength(1);
  });

  it('V2E-16 · ⭐ a small sync downloads only what changed, not the whole account', async () => {
    const { account, phone, pc } = twoDevices();
    await phone.sync();
    for (let i = 0; i < 50; i++) phone.edit({ type: 'ADD_HABIT', title: `Habit ${i}` });
    await phone.sync();
    await pc.sync();
    expect(pc.titles()).toHaveLength(50);

    // Every small sync re-reads the two minutes of writes just before the newest row
    // it has seen (see CURSOR_OVERLAP_MS). So first let those 50 age out of that
    // window: ten minutes later, one more habit, and the PC catches up.
    account.advance(10 * 60_000);
    phone.setClock(600);
    phone.edit({ type: 'ADD_HABIT', title: 'Marker' });
    await phone.sync();
    await pc.sync();

    // Ten more minutes, one more habit.
    account.advance(10 * 60_000);
    phone.setClock(700);
    phone.edit({ type: 'ADD_HABIT', title: 'One more' });
    await phone.sync();

    pc.setClock(700);
    account.resetRowsServed();
    await pc.sync();

    expect(pc.titles()).toHaveLength(52);
    // Only "Marker" (inside the overlap) and "One more": never the 50 older habits.
    expect(account.rowsServed()).toBe(2);
  });

  it('V2E-17 · ⭐ a write that commits late, stamped just before the cursor, is still picked up', async () => {
    const { account, phone, pc } = twoDevices();
    await phone.sync();
    phone.edit({ type: 'ADD_HABIT', title: 'First' });
    await phone.sync();
    await pc.sync();

    // Another device's slow write lands now, but carries a server time 30 seconds
    // before the latest one the PC has already seen.
    account.writeLateHabit(
      { id: 'late', title: 'Committed late', createdAt: account.now(), updatedAt: '2026-09-18T09:30:00.000Z', archivedAt: null, deletedAt: null },
      30_000,
    );
    await pc.sync();

    expect(pc.titles()).toContain('Committed late');
  });

  it('V2E-18 · an edit made after a sync started stays in the outbox for the next one', async () => {
    const { phone, pc, id } = await bothWith('Meditate');
    phone.setClock(30);
    phone.edit({ type: 'RENAME_HABIT', id, title: 'Meditate 5 min' });

    // Start a sync, then edit the same habit before it finishes.
    const running = phone.sync();
    phone.edit({ type: 'RENAME_HABIT', id, title: 'Meditate 10 min' }, 31);
    await running;

    expect(phone.outbox()).toEqual([`habit:${id}`]);
    await phone.sync();
    await pc.sync();
    expect(pc.titles()).toEqual(['Meditate 10 min']);
  });

  it('V2E-19 · with no cursor yet, a small sync does the full combine (nothing is skipped)', async () => {
    const { account, phone } = twoDevices();
    await account.remote().push({
      habits: [{ id: 'old', title: 'Already in account', createdAt: account.now(), updatedAt: account.now(), archivedAt: null, deletedAt: null }],
      tasks: [],
      completions: [],
    });
    phone.edit({ type: 'ADD_HABIT', title: 'On phone' });

    const result = await phone.sync();

    expect(phone.titles().sort()).toEqual(['Already in account', 'On phone']);
    expect(changeCount(result.pushed)).toBe(1);
    expect(phone.cursor()).not.toBeNull();
  });
});
