// @vitest-environment jsdom
import { fireEvent, render, screen } from '@testing-library/react';
import { useState } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { DAILY, formatSchedule, type Schedule } from '@/lib/schedule';
import type { Habit } from '@/lib/types';
import { ScheduleSheet } from './ScheduleSheet';

/*
 * v4 Block B: the "how often?" sheet.
 *
 * It holds no state of its own — what it shows comes from the habit, and every
 * choice is written straight away. These tests are about what a person can do
 * with it: see what is set now, change it, and never end up with a habit that
 * is due on no days at all.
 */

/** 2026-09-30 is a Wednesday, so "today" is day 2 with Monday as 0. */
const TODAY = '2026-09-30';

function habit(schedule: string | null): Habit {
  return {
    id: 'h1',
    title: 'Drink water',
    createdAt: '2026-09-01T00:00:00.000Z',
    updatedAt: '2026-09-01T00:00:00.000Z',
    archivedAt: null,
    deletedAt: null,
    position: null,
    schedule,
  };
}

/**
 * The sheet as the app wires it: every choice goes to the store and comes back
 * as a new `habit`. Testing it any other way would show a sheet that never
 * updates, which is not what anyone using it would see.
 */
function Harness({
  initial,
  onChoose,
  onClose,
}: {
  initial: string | null;
  onChoose: (schedule: Schedule) => void;
  onClose: () => void;
}) {
  const [stored, setStored] = useState(initial);
  return (
    <ScheduleSheet
      habit={habit(stored)}
      today={TODAY}
      onChoose={(schedule) => {
        onChoose(schedule);
        setStored(formatSchedule(schedule));
      }}
      onClose={onClose}
    />
  );
}

function open(schedule: string | null) {
  const onChoose = vi.fn<(schedule: Schedule) => void>();
  const onClose = vi.fn();
  render(<Harness initial={schedule} onChoose={onChoose} onClose={onClose} />);
  /** What the latest choice stored. */
  const stored = () => formatSchedule(onChoose.mock.lastCall![0]);
  return { onChoose, onClose, stored };
}

const day = (name: string) => screen.getByRole('button', { name });

describe('the how-often sheet', () => {
  it('V4B-42 · ⭐ says what the habit is set to now', () => {
    open('weekdays:0,2,4');

    expect(screen.getByRole('dialog')).toHaveTextContent('Drink water — Mon, Wed and Fri');
    expect(screen.getByRole('radio', { name: /Certain days/ })).toBeChecked();
    expect(day('Monday')).toHaveAttribute('aria-pressed', 'true');
    expect(day('Tuesday')).toHaveAttribute('aria-pressed', 'false');
  });

  it('V4B-43 · ⭐ a habit with nothing set reads as every day', () => {
    open(null);

    expect(screen.getByRole('radio', { name: /Every day/ })).toBeChecked();
    // The days are only offered once "certain days" is the choice.
    expect(screen.queryByRole('button', { name: 'Monday' })).toBeNull();
  });

  it('V4B-44 · ⭐ choosing certain days starts with today, never with no days', () => {
    // A habit due on no days would simply never appear again.
    const { stored } = open(null);

    fireEvent.click(screen.getByRole('radio', { name: /Certain days/ }));

    expect(stored()).toBe('weekdays:2'); // Wednesday
  });

  it('V4B-45 · ⭐ turning days on and off writes each change', () => {
    const { stored } = open('weekdays:2');

    fireEvent.click(day('Friday'));
    expect(stored()).toBe('weekdays:2,4');
  });

  it('V4B-46 · ⭐ the last day cannot be turned off', () => {
    const { onChoose } = open('weekdays:2');

    fireEvent.click(day('Wednesday'));

    expect(onChoose).not.toHaveBeenCalled();
    expect(day('Wednesday')).toHaveAttribute('aria-pressed', 'true');
  });

  it('V4B-47 · ⭐ a few times a week can be chosen, and how many', () => {
    const { stored } = open(null);

    fireEvent.click(screen.getByRole('radio', { name: /A few times a week/ }));
    expect(stored()).toBe('weekly:3'); // a sensible start

    fireEvent.click(screen.getByRole('button', { name: '5 times a week' }));
    expect(stored()).toBe('weekly:5');
  });

  it('V4B-48 · going back to every day clears the schedule', () => {
    const { onChoose, stored } = open('weekly:5');

    fireEvent.click(screen.getByRole('radio', { name: /Every day/ }));

    expect(onChoose).toHaveBeenCalledWith(DAILY);
    expect(stored()).toBeNull();
  });

  it('V4B-49 · Escape closes it, and there is nothing to save', () => {
    const { onClose } = open(null);

    expect(screen.queryByRole('button', { name: /save/i })).toBeNull();
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(onClose).toHaveBeenCalled();
  });
});
