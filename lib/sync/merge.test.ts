import { describe, expect, it } from 'vitest';
import type { Habit, HabibitState, Task } from '@/lib/types';
import { changesToPush, hasChanges, mergeStates } from './merge';

const T = (minute: number) => new Date(Date.UTC(2026, 8, 17, 8, minute)).toISOString();

function habit(id: string, title: string, updated = 0, extra: Partial<Habit> = {}): Habit {
  return { id, title, createdAt: T(0), updatedAt: T(updated), archivedAt: null, deletedAt: null, ...extra };
}
function task(id: string, title: string, updated = 0, extra: Partial<Task> = {}): Task {
  return { id, title, createdAt: T(0), updatedAt: T(updated), completedAt: null, deletedAt: null, ...extra };
}
function state(parts: Partial<HabibitState> = {}): HabibitState {
  return { habits: [], tasks: [], completions: {}, ...parts };
}

describe('the first sign-in cases', () => {
  const phone = state({
    habits: [habit('h-phone', 'Drink water')],
    tasks: [task('t-phone', 'Call mum')],
    completions: { 'h-phone::2026-09-17': { done: true, updatedAt: T(1) } },
  });
  const account = state({
    habits: [habit('h-account', 'Stretch')],
    completions: { 'h-account::2026-09-16': { done: true, updatedAt: T(1) } },
  });

  it('V2D-01 · empty device + account with data → the account’s data', () => {
    expect(mergeStates(state(), account)).toEqual(account);
  });

  it('V2D-02 · ⭐ device with data + EMPTY account → the device’s data, nothing wiped', () => {
    // The classic data-wipe bug: treating "the account is empty" as the truth.
    expect(mergeStates(phone, state())).toEqual(phone);
  });

  it('V2D-03 · both have data → everything from both', () => {
    const merged = mergeStates(phone, account);
    expect(merged.habits.map((h) => h.id).sort()).toEqual(['h-account', 'h-phone']);
    expect(merged.tasks.map((t) => t.id)).toEqual(['t-phone']);
    expect(Object.keys(merged.completions).sort()).toEqual(['h-account::2026-09-16', 'h-phone::2026-09-17']);
  });

  it('V2D-04 · two habits with the same name made separately are both kept', () => {
    const merged = mergeStates(
      state({ habits: [habit('a', 'Drink water')] }),
      state({ habits: [habit('b', 'Drink water')] }),
    );
    expect(merged.habits.map((h) => h.id).sort()).toEqual(['a', 'b']);
  });
});

describe('latest change wins, per record', () => {
  it('V2D-05 · a newer rename beats an older one, whichever side it is on', () => {
    const older = state({ habits: [habit('h', 'Drink watr', 1)] });
    const newerRename = state({ habits: [habit('h', 'Drink water', 5)] });
    expect(mergeStates(older, newerRename).habits[0].title).toBe('Drink water');
    expect(mergeStates(newerRename, older).habits[0].title).toBe('Drink water');
  });

  it('V2D-06 · a newer delete beats an older edit', () => {
    const edited = state({ habits: [habit('h', 'Edited', 2)] });
    const deleted = state({ habits: [habit('h', 'Edited', 3, { deletedAt: T(3) })] });
    expect(mergeStates(edited, deleted).habits[0].deletedAt).toBe(T(3));
  });

  it('V2D-07 · a newer edit beats an older delete', () => {
    const deleted = state({ habits: [habit('h', 'Old', 2, { deletedAt: T(2) })] });
    const edited = state({ habits: [habit('h', 'New', 4)] });
    expect(mergeStates(deleted, edited).habits[0]).toMatchObject({ title: 'New', deletedAt: null });
  });

  it('V2D-08 · at exactly the same instant, a delete wins, so a tie never resurrects a habit', () => {
    const edited = state({ habits: [habit('h', 'Edited', 3)] });
    const deleted = state({ habits: [habit('h', 'Edited', 3, { deletedAt: T(3) })] });
    expect(mergeStates(edited, deleted).habits[0].deletedAt).toBe(T(3));
    expect(mergeStates(deleted, edited).habits[0].deletedAt).toBe(T(3));
  });

  it('V2D-09 · an untick made later beats an earlier tick, for the same habit and day', () => {
    const ticked = state({ habits: [habit('h', 'x')], completions: { 'h::2026-09-17': { done: true, updatedAt: T(1) } } });
    const unticked = state({ habits: [habit('h', 'x')], completions: { 'h::2026-09-17': { done: false, updatedAt: T(2) } } });
    expect(mergeStates(ticked, unticked).completions['h::2026-09-17']).toEqual({ done: false, updatedAt: T(2) });
    expect(mergeStates(unticked, ticked).completions['h::2026-09-17']).toEqual({ done: false, updatedAt: T(2) });
  });

  it('V2D-10 · decisions are per record: one habit can come from each side', () => {
    const a = state({ habits: [habit('h1', 'A-new', 9), habit('h2', 'A-old', 1)] });
    const b = state({ habits: [habit('h1', 'B-old', 1), habit('h2', 'B-new', 9)] });
    expect(mergeStates(a, b).habits.map((h) => h.title)).toEqual(['A-new', 'B-new']);
  });

  it('compares instants, not strings: the same time written two ways is equal', () => {
    const a = state({ habits: [habit('h', 'x', 0, { updatedAt: '2026-09-17T08:05:00.000Z' })] });
    const b = state({ habits: [habit('h', 'x', 0, { updatedAt: '2026-09-17T16:05:00.000+08:00' })] });
    expect(mergeStates(a, b).habits).toHaveLength(1);
  });
});

describe('merging is safe to repeat', () => {
  const a = state({
    habits: [habit('h1', 'One', 4), habit('h2', 'Two', 1, { deletedAt: T(1) })],
    tasks: [task('t1', 'Task', 2, { completedAt: T(2) })],
    completions: { 'h1::2026-09-17': { done: true, updatedAt: T(3) } },
  });
  const b = state({
    habits: [habit('h1', 'Uno', 2), habit('h3', 'Three', 5)],
    completions: { 'h1::2026-09-17': { done: false, updatedAt: T(6) } },
  });

  it('V2D-11 · the order of the two sides does not matter', () => {
    expect(mergeStates(a, b)).toEqual(mergeStates(b, a));
  });

  it('V2D-12 · merging the result again changes nothing', () => {
    const once = mergeStates(a, b);
    expect(mergeStates(once, a)).toEqual(once);
    expect(mergeStates(once, b)).toEqual(once);
    expect(mergeStates(once, once)).toEqual(once);
  });

  it('never mutates either input', () => {
    const aCopy = structuredClone(a);
    const bCopy = structuredClone(b);
    mergeStates(a, b);
    expect(a).toEqual(aCopy);
    expect(b).toEqual(bCopy);
  });

  it('lists habits oldest first, identically on every device', () => {
    const early = habit('z', 'Early', 0, { createdAt: '2026-09-01T00:00:00.000Z' });
    const late = habit('a', 'Late', 0, { createdAt: '2026-09-10T00:00:00.000Z' });
    expect(mergeStates(state({ habits: [late] }), state({ habits: [early] })).habits.map((h) => h.title)).toEqual([
      'Early',
      'Late',
    ]);
  });
});

describe('what needs uploading', () => {
  it('V2D-13 · only records the account lacks or has an older version of', () => {
    const remote = state({
      habits: [habit('same', 'Same', 1), habit('stale', 'Old name', 1)],
      completions: { 'same::2026-09-17': { done: true, updatedAt: T(1) } },
    });
    const merged = state({
      habits: [habit('same', 'Same', 1), habit('stale', 'New name', 5), habit('new', 'Brand new', 5)],
      completions: {
        'same::2026-09-17': { done: true, updatedAt: T(1) },
        'new::2026-09-17': { done: true, updatedAt: T(5) },
      },
    });

    const changes = changesToPush(merged, remote);
    expect(changes.habits.map((h) => h.id)).toEqual(['stale', 'new']);
    expect(changes.completions.map(([key]) => key)).toEqual(['new::2026-09-17']);
    expect(hasChanges(changes)).toBe(true);
  });

  it('V2D-14 · nothing to upload when the account already matches', () => {
    const same = state({ habits: [habit('h', 'x')], tasks: [task('t', 'y')] });
    expect(hasChanges(changesToPush(same, structuredClone(same)))).toBe(false);
  });

  it('never uploads a completion for a habit that does not exist, which the database would reject', () => {
    const merged = state({ completions: { 'ghost::2026-09-17': { done: true, updatedAt: T(1) } } });
    expect(changesToPush(merged, state()).completions).toEqual([]);
  });
});
