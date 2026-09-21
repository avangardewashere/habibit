import { describe, expect, it } from 'vitest';
import { completionKey } from '@/lib/keys';
import { mergeStates } from '@/lib/sync/merge';
import { touchedBy } from '@/lib/sync/sync';
import type { HabibitState } from '@/lib/types';
import { habibitReducer, initialState, stamp, type HabibitIntent } from './reducer';
import { activeHabits, liveHabits, sortedTasks } from './selectors';

/*
 * v4 Block A: undo, in the reducer and in sync.
 *
 * The screen part is easy. What has to be exactly right is timing: an undo must
 * be *strictly newer* than the delete it undoes, because sync deliberately keeps
 * the delete on a tie (so a tie can never bring back something deleted), and the
 * server keeps whatever it has when a write is older. Wall clocks can go
 * backwards, so "a few seconds later" is not something to rely on.
 */

const at = (iso: string) => new Date(iso);

/** Applies one intent at a chosen wall-clock time. */
function apply(state: HabibitState, intent: HabibitIntent, when: string, id = 'h1'): HabibitState {
  return habibitReducer(state, stamp(intent, at(when), () => id));
}

/** A habit with a week of history: added, ticked twice. */
function habitWithHistory(): HabibitState {
  let s = apply(initialState, { type: 'ADD_HABIT', title: 'Water' }, '2026-09-20T08:00:00.000Z');
  s = apply(s, { type: 'TOGGLE_COMPLETION', habitId: 'h1', dateKey: '2026-09-19' }, '2026-09-20T08:01:00.000Z');
  s = apply(s, { type: 'TOGGLE_COMPLETION', habitId: 'h1', dateKey: '2026-09-20' }, '2026-09-20T08:02:00.000Z');
  return s;
}

const DELETED_AT = '2026-09-20T09:00:00.000Z';

describe('taking a delete back', () => {
  it('V4A-01 · ⭐ a restored habit comes back exactly as it was, history included', () => {
    const before = habitWithHistory();
    const deleted = apply(before, { type: 'REMOVE_HABIT', id: 'h1' }, DELETED_AT);
    expect(liveHabits(deleted)).toEqual([]);

    const restored = apply(deleted, { type: 'RESTORE_HABIT', id: 'h1' }, '2026-09-20T09:00:04.000Z');

    const habit = restored.habits.find((h) => h.id === 'h1')!;
    expect(habit.deletedAt).toBeNull();
    expect(habit.title).toBe('Water');
    expect(activeHabits(restored).map((h) => h.id)).toEqual(['h1']);
    // The completions were never touched by the delete, so the history is simply there.
    expect(restored.completions[completionKey('h1', '2026-09-19')]?.done).toBe(true);
    expect(restored.completions[completionKey('h1', '2026-09-20')]?.done).toBe(true);
    expect(restored.completions).toEqual(before.completions);
  });

  it('V4A-02 · ⭐ the undo is newer than the delete, so sync treats it as the latest change', () => {
    const deleted = apply(habitWithHistory(), { type: 'REMOVE_HABIT', id: 'h1' }, DELETED_AT);
    const restored = apply(deleted, { type: 'RESTORE_HABIT', id: 'h1' }, '2026-09-20T09:00:04.000Z');

    expect(Date.parse(restored.habits[0].updatedAt)).toBeGreaterThan(Date.parse(DELETED_AT));
    expect(restored.habits[0].updatedAt).toBe('2026-09-20T09:00:04.000Z');
  });

  it('V4A-03 · ⭐ an undo at the very same millisecond is still strictly newer', () => {
    const deleted = apply(habitWithHistory(), { type: 'REMOVE_HABIT', id: 'h1' }, DELETED_AT);
    const restored = apply(deleted, { type: 'RESTORE_HABIT', id: 'h1' }, DELETED_AT);

    expect(Date.parse(restored.habits[0].updatedAt)).toBe(Date.parse(DELETED_AT) + 1);
  });

  it('V4A-04 · ⭐ an undo after the clock went backwards is still strictly newer', () => {
    // The phone corrected its time between the delete and the undo. The undo's
    // own timestamp is *earlier* than the delete's.
    const deleted = apply(habitWithHistory(), { type: 'REMOVE_HABIT', id: 'h1' }, DELETED_AT);
    const restored = apply(deleted, { type: 'RESTORE_HABIT', id: 'h1' }, '2026-09-20T08:59:30.000Z');

    expect(Date.parse(restored.habits[0].updatedAt)).toBeGreaterThan(Date.parse(DELETED_AT));
    expect(restored.habits[0].deletedAt).toBeNull();
  });

  it('V4A-05 · restoring something that was never deleted changes nothing', () => {
    const live = habitWithHistory();
    expect(apply(live, { type: 'RESTORE_HABIT', id: 'h1' }, DELETED_AT)).toBe(live);
    expect(apply(live, { type: 'RESTORE_HABIT', id: 'nope' }, DELETED_AT)).toBe(live);
  });

  it('V4A-06 · ⭐ tasks can be taken back the same way', () => {
    let s = apply(initialState, { type: 'ADD_TASK', title: 'Post letter' }, '2026-09-20T08:00:00.000Z', 't1');
    s = apply(s, { type: 'REMOVE_TASK', id: 't1' }, DELETED_AT);
    expect(sortedTasks(s)).toEqual([]);

    s = apply(s, { type: 'RESTORE_TASK', id: 't1' }, '2026-09-20T08:59:00.000Z');

    expect(sortedTasks(s).map((t) => t.title)).toEqual(['Post letter']);
    expect(Date.parse(s.tasks[0].updatedAt)).toBeGreaterThan(Date.parse(DELETED_AT));
  });
});

describe('undo and sync', () => {
  it('V4A-10 · ⭐ an undo made after the delete had already synced still wins', () => {
    // The account got the delete. Then this device undid it.
    const deleted = apply(habitWithHistory(), { type: 'REMOVE_HABIT', id: 'h1' }, DELETED_AT);
    const restored = apply(deleted, { type: 'RESTORE_HABIT', id: 'h1' }, '2026-09-20T09:00:04.000Z');

    const merged = mergeStates(restored, deleted);

    expect(merged.habits[0].deletedAt).toBeNull();
  });

  it('V4A-11 · ⭐ …even when the undo was stamped before the delete, by a clock that went back', () => {
    // Without the strictly-newer rule this is the case that loses: an older
    // version, or a tie, and sync keeps the delete.
    const deleted = apply(habitWithHistory(), { type: 'REMOVE_HABIT', id: 'h1' }, DELETED_AT);
    const restored = apply(deleted, { type: 'RESTORE_HABIT', id: 'h1' }, '2026-09-20T08:59:30.000Z');

    expect(mergeStates(restored, deleted).habits[0].deletedAt).toBeNull();
    // And from the other device's point of view, the same answer.
    expect(mergeStates(deleted, restored).habits[0].deletedAt).toBeNull();
  });

  it('V4A-12 · ⭐ another device that already saw the delete brings the habit back', () => {
    const deleted = apply(habitWithHistory(), { type: 'REMOVE_HABIT', id: 'h1' }, DELETED_AT);
    const otherDevice = deleted; // pulled the delete earlier
    const restored = apply(deleted, { type: 'RESTORE_HABIT', id: 'h1' }, '2026-09-20T09:00:04.000Z');

    const later = mergeStates(otherDevice, restored);

    expect(activeHabits(later).map((h) => h.title)).toEqual(['Water']);
    expect(later.completions[completionKey('h1', '2026-09-19')]?.done).toBe(true);
  });
});

describe('what reaches the sync queue', () => {
  const stamped = (intent: HabibitIntent) => stamp(intent, at(DELETED_AT), () => 'h1');

  it('V4A-20 · ⭐ an undo is sent to the account', () => {
    expect(touchedBy(stamped({ type: 'RESTORE_HABIT', id: 'h1' }))).toBe('habit:h1');
    expect(touchedBy(stamped({ type: 'RESTORE_TASK', id: 't1' }))).toBe('task:t1');
  });

  it('V4A-21 · ⭐ reorder, archive and unarchive are sent to the account (a v3 gap)', () => {
    // These were added in v3 Block B but never named here, so they fell through
    // to "not an edit" and only reached the account when the app next opened.
    expect(touchedBy(stamped({ type: 'MOVE_HABIT', id: 'h1', toIndex: 0 }))).toBe('habit:h1');
    expect(touchedBy(stamped({ type: 'ARCHIVE_HABIT', id: 'h1' }))).toBe('habit:h1');
    expect(touchedBy(stamped({ type: 'UNARCHIVE_HABIT', id: 'h1' }))).toBe('habit:h1');
  });

  it('V4A-22 · things that are not edits made here are still not sent', () => {
    expect(touchedBy({ type: 'HYDRATE', state: initialState })).toBeNull();
    expect(touchedBy({ type: 'MERGE_REMOTE', state: initialState })).toBeNull();
    expect(touchedBy({ type: 'CLEAR_DEVICE' })).toBeNull();
  });
});
