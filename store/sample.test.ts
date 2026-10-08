import { describe, expect, it } from 'vitest';
import { isSampleId, sampleState } from '@/lib/sample';
import { touchedBy } from '@/lib/sync/sync';
import type { HabibitState } from '@/lib/types';
import { habibitReducer, initialState, stamp } from './reducer';

/*
 * v5 Block C: loading and clearing the sample, in the store.
 *
 * The rules: loading never touches what you added, loading twice doesn't
 * double it, clearing removes the sample and only the sample, and neither is
 * ever queued for an account.
 */

const TODAY = '2026-10-07';
const T = (minute: number) => new Date(Date.UTC(2026, 9, 7, 2, minute));

function withMine(): HabibitState {
  return habibitReducer(initialState, stamp({ type: 'ADD_HABIT', title: 'Mine' }, T(0), () => 'mine-1'));
}

describe('V5C: the sample, in the store', () => {
  it('V5C-20 · ⭐ loading adds the sample beside what you already have', () => {
    const next = habibitReducer(withMine(), stamp({ type: 'LOAD_SAMPLE', today: TODAY }, T(1)));
    expect(next.habits.map((h) => h.title)).toEqual(['Mine', ...sampleState(TODAY).habits.map((h) => h.title)]);
    expect(next.tasks).toHaveLength(3);
  });

  it('V5C-21 · ⭐ loading twice gives one sample, not two', () => {
    const once = habibitReducer(initialState, stamp({ type: 'LOAD_SAMPLE', today: TODAY }, T(1)));
    const twice = habibitReducer(once, stamp({ type: 'LOAD_SAMPLE', today: TODAY }, T(2)));
    expect(twice.habits).toHaveLength(6);
    expect(Object.keys(twice.completions)).toHaveLength(Object.keys(once.completions).length);
  });

  it('V5C-22 · ⭐ clearing removes the sample and nothing else — your habit and its ticks stay', () => {
    let state = withMine();
    state = habibitReducer(state, stamp({ type: 'TOGGLE_COMPLETION', habitId: 'mine-1', dateKey: TODAY }, T(1)));
    state = habibitReducer(state, stamp({ type: 'LOAD_SAMPLE', today: TODAY }, T(2)));
    const cleared = habibitReducer(state, stamp({ type: 'CLEAR_SAMPLE' }, T(3)));

    expect(cleared.habits.map((h) => h.title)).toEqual(['Mine']);
    expect(cleared.tasks).toEqual([]);
    expect(Object.keys(cleared.completions)).toEqual([`mine-1::${TODAY}`]);
  });

  it('V5C-23 · clearing takes deleted samples too, since no account ever heard of them', () => {
    let state = habibitReducer(initialState, stamp({ type: 'LOAD_SAMPLE', today: TODAY }, T(1)));
    const first = state.habits[0].id;
    state = habibitReducer(state, stamp({ type: 'REMOVE_HABIT', id: first }, T(2)));
    const cleared = habibitReducer(state, stamp({ type: 'CLEAR_SAMPLE' }, T(3)));
    expect(cleared.habits.some((h) => isSampleId(h.id))).toBe(false);
  });

  it('V5C-24 · ⭐ clearing with no sample there changes nothing — the same state, untouched', () => {
    const mine = withMine();
    expect(habibitReducer(mine, stamp({ type: 'CLEAR_SAMPLE' }, T(1)))).toBe(mine);
  });

  it('V5C-25 · ⭐ neither loading nor clearing is ever queued for an account', () => {
    expect(touchedBy(stamp({ type: 'LOAD_SAMPLE', today: TODAY }, T(1)))).toBeNull();
    expect(touchedBy(stamp({ type: 'CLEAR_SAMPLE' }, T(1)))).toBeNull();
  });
});
