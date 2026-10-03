import { describe, expect, it } from 'vitest';
import { NO_ICON, resolveColour, resolveIcon } from '@/lib/look';
import { touchedBy } from '@/lib/sync/sync';
import type { HabibitState } from '@/lib/types';
import { habibitReducer, initialState, stamp } from './reducer';

/*
 * v5 Block A: choosing a habit's colour and icon, in the store.
 *
 * The rules being guarded are the ones every other habit field already has —
 * a no-op is not an edit, a deleted habit is not there, and a new action must
 * be registered with sync — plus the one that is new: adding a habit stores no
 * look at all, because a stored default would be a lie about what was chosen
 * and would leave every habit made before v5 grey for ever.
 */

const T = (minute: number) => new Date(Date.UTC(2026, 9, 3, 9, minute));
const at = (minute: number) => T(minute).toISOString();

function withHabit(title = 'Drink water'): { state: HabibitState; id: string } {
  const state = habibitReducer(initialState, stamp({ type: 'ADD_HABIT', title }, T(0), () => 'h1'));
  return { state, id: 'h1' };
}

describe('V5A: a new habit', () => {
  it('V5A-30 · ⭐ is stored with no look at all', () => {
    const { state } = withHabit();
    expect(state.habits[0]).toMatchObject({ icon: null, colour: null });
  });

  it('V5A-31 · ⭐ but is still drawn with one', () => {
    // The pair of V5A-30, and the reason it is allowed to store nothing.
    const { state } = withHabit();
    const habit = state.habits[0];
    expect(resolveColour(habit.colour, habit.id)).toBeTruthy();
    expect(resolveIcon(habit.icon, habit.title)).toBe('droplet');
  });
});

describe('V5A: choosing a look', () => {
  it('V5A-32 · ⭐ stores both, and dates the change', () => {
    const { state, id } = withHabit();
    const next = habibitReducer(state, stamp({ type: 'SET_LOOK', id, icon: 'moon', colour: 'teal' }, T(5)));

    expect(next.habits[0]).toMatchObject({ icon: 'moon', colour: 'teal', updatedAt: at(5) });
  });

  it('V5A-33 · ⭐ choosing what it already is changes nothing at all', () => {
    // Not merely "looks the same": the identical object. Bumping updatedAt
    // here would upload the row and beat a real change made on another device
    // — the same trap SET_SCHEDULE was given a guard for in v4 Block C.
    const { state, id } = withHabit();
    const chosen = habibitReducer(state, stamp({ type: 'SET_LOOK', id, icon: 'moon', colour: 'teal' }, T(5)));
    const again = habibitReducer(chosen, stamp({ type: 'SET_LOOK', id, icon: 'moon', colour: 'teal' }, T(9)));

    expect(again).toBe(chosen);
    expect(again.habits[0].updatedAt).toBe(at(5));
  });

  it('V5A-34 · clearing one back to nothing is a real change', () => {
    const { state, id } = withHabit();
    const chosen = habibitReducer(state, stamp({ type: 'SET_LOOK', id, icon: 'moon', colour: 'teal' }, T(5)));
    const cleared = habibitReducer(chosen, stamp({ type: 'SET_LOOK', id, icon: null, colour: null }, T(9)));

    expect(cleared.habits[0]).toMatchObject({ icon: null, colour: null, updatedAt: at(9) });
  });

  it('V5A-35 · ⭐ asking for no icon is stored, and is not the same as nothing chosen', () => {
    const { state, id } = withHabit('Read the news');
    const none = habibitReducer(state, stamp({ type: 'SET_LOOK', id, icon: NO_ICON, colour: null }, T(5)));

    expect(none.habits[0].icon).toBe(NO_ICON);
    expect(resolveIcon(none.habits[0].icon, 'Read the news')).toBeNull();
  });

  it('V5A-36 · ⭐ a value that is not shaped like a name is refused, not stored', () => {
    // The chooser can only offer what it can draw, so this is a tampered or
    // buggy call. Storing it would push past the database's own check on the
    // next sync and fail the upload for every other record in the batch.
    const { state, id } = withHabit();
    const next = habibitReducer(
      state,
      stamp({ type: 'SET_LOOK', id, icon: 'Moon Phase!', colour: 'x'.repeat(99) }, T(5)),
    );

    expect(next).toBe(state);
  });

  it('V5A-37 · a deleted habit cannot be given one', () => {
    const { state, id } = withHabit();
    const deleted = habibitReducer(state, stamp({ type: 'REMOVE_HABIT', id }, T(2)));
    const next = habibitReducer(deleted, stamp({ type: 'SET_LOOK', id, icon: 'moon', colour: 'teal' }, T(5)));

    expect(next).toBe(deleted);
  });

  it('V5A-38 · a habit that was never there is ignored', () => {
    const { state } = withHabit();
    expect(habibitReducer(state, stamp({ type: 'SET_LOOK', id: 'nope', icon: 'moon', colour: 'teal' }, T(5)))).toBe(state);
  });

  it('V5A-39 · ⭐ the change is queued for the account', () => {
    /*
     * v4 Block A found three actions that were never registered here and so
     * only reached other devices on the next app open. `touchedBy` is a
     * compile-time exhaustive switch now, so a missing case fails the build —
     * but nothing checks that the case returns the *right* key, and a look
     * filed under the wrong record would never sync.
     */
    expect(touchedBy(stamp({ type: 'SET_LOOK', id: 'h1', icon: 'moon', colour: 'teal' }, T(5)))).toBe('habit:h1');
  });
});
