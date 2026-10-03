// @vitest-environment jsdom
import { fireEvent, render, screen } from '@testing-library/react';
import { useState } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { NO_ICON, colourFor, type StoredLook } from '@/lib/look';
import type { Habit } from '@/lib/types';
import { HabitLook } from './HabitLook';

/*
 * v5 Block A: choosing a habit's colour and icon.
 *
 * The thing worth testing here is not that buttons exist. It is that the
 * chooser tells the truth about a habit nobody has chosen for: the colour it is
 * *drawn* in is shown as selected, even though nothing is stored. Showing six
 * unselected swatches beside a row that is visibly teal would be the bug.
 */

function habit(over: Partial<Habit> = {}): Habit {
  return {
    id: 'h1',
    title: 'Drink water',
    createdAt: '2026-10-01T00:00:00.000Z',
    updatedAt: '2026-10-01T00:00:00.000Z',
    archivedAt: null,
    deletedAt: null,
    position: null,
    schedule: null,
    icon: null,
    colour: null,
    ...over,
  };
}

/** The chooser as the app wires it: every tap goes to the store and comes back. */
function Harness({ initial, onChoose }: { initial: Habit; onChoose: (i: StoredLook, c: StoredLook) => void }) {
  const [look, setLook] = useState({ icon: initial.icon, colour: initial.colour });
  return (
    <HabitLook
      habit={{ ...initial, ...look }}
      onChoose={(icon, colour) => {
        onChoose(icon, colour);
        setLook({ icon, colour });
      }}
    />
  );
}

function open(over: Partial<Habit> = {}) {
  const onChoose = vi.fn();
  render(<Harness initial={habit(over)} onChoose={onChoose} />);
  return onChoose;
}

const chosen = (name: string) => screen.getByRole('button', { name }).getAttribute('aria-pressed');

describe('the look chooser', () => {
  it('V5A-50 · ⭐ shows the derived colour as the chosen one, though nothing is stored', () => {
    open({ id: 'abc-123' });

    // Whatever the id happens to hash to — asserting the hash's output here
    // would only restate the implementation.
    const expected = colourFor('abc-123');
    expect(chosen(expected.charAt(0).toUpperCase() + expected.slice(1))).toBe('true');
  });

  it('V5A-51 · ⭐ shows the guessed icon as the chosen one', () => {
    open();
    expect(chosen('Water')).toBe('true');
    expect(chosen('Moon')).toBe('false');
  });

  it('V5A-52 · ⭐ picking a colour writes it, and keeps the icon as it was', () => {
    // Two fields, one action. A chooser that sent `icon: null` here would
    // quietly throw away an icon the owner had picked.
    const onChoose = open({ icon: 'moon' });

    fireEvent.click(screen.getByRole('button', { name: 'Teal' }));

    expect(onChoose).toHaveBeenCalledWith('moon', 'teal');
  });

  it('V5A-53 · ⭐ picking an icon writes it, and keeps the colour as it was', () => {
    const onChoose = open({ colour: 'violet' });

    fireEvent.click(screen.getByRole('button', { name: 'Moon' }));

    expect(onChoose).toHaveBeenCalledWith('moon', 'violet');
  });

  it('V5A-54 · the choice moves as soon as it is made — there is no Save', () => {
    open();

    fireEvent.click(screen.getByRole('button', { name: 'Moon' }));

    expect(chosen('Moon')).toBe('true');
    expect(chosen('Water')).toBe('false');
  });

  it('V5A-55 · ⭐ "no icon" is offered, and turns the guess off', () => {
    const onChoose = open();
    expect(chosen('No icon')).toBe('false');

    fireEvent.click(screen.getByRole('button', { name: 'No icon' }));

    expect(onChoose).toHaveBeenCalledWith(NO_ICON, null);
    expect(chosen('No icon')).toBe('true');
    expect(chosen('Water')).toBe('false');
  });

  it('V5A-56 · a title that suggests nothing shows no icon as chosen, without being asked', () => {
    open({ title: 'Zzzzz qqq' });
    expect(chosen('No icon')).toBe('true');
  });

  it('V5A-57 · ⭐ every control can be reached and named without sight', () => {
    open();
    // Colour is never the only signal: each swatch carries its name, and the
    // chosen one carries a tick as well as a ring (V5A-50 reads the state).
    for (const name of ['Coral', 'Amber', 'Green', 'Teal', 'Blue', 'Violet']) {
      expect(screen.getByRole('button', { name }), name).toBeVisible();
    }
    for (const name of ['Water', 'Book', 'Piggy bank', 'No icon']) {
      expect(screen.getByRole('button', { name }), name).toBeVisible();
    }
  });

  it('V5A-58 · a stored colour this build cannot draw does not leave the chooser blank', () => {
    // It stays stored; the chooser shows what is actually on screen, which is
    // the derived colour.
    open({ id: 'abc-123', colour: 'ultramarine' });
    const expected = colourFor('abc-123');
    expect(chosen(expected.charAt(0).toUpperCase() + expected.slice(1))).toBe('true');
  });
});
