// @vitest-environment jsdom
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { DateKey } from '@/lib/types';
import { DayStrip } from './DayStrip';

/*
 * v4 Block C: the seven-day strip, once a habit has days off.
 *
 * A day the habit was never due must not look like a day it failed — and must
 * still be tappable, because doing it anyway is still doing it.
 *
 *   2026-09-28 Mon · 29 Tue · 30 Wed  ← today
 */

const DAYS: DateKey[] = [
  '2026-09-24',
  '2026-09-25',
  '2026-09-26',
  '2026-09-27',
  '2026-09-28',
  '2026-09-29',
  '2026-09-30',
];
const TODAY: DateKey = '2026-09-30';

/** Mon, Wed and Fri — so the 25th, 28th and 30th are due, the rest are not. */
const dueMonWedFri = (day: DateKey) => ['2026-09-25', '2026-09-28', '2026-09-30'].includes(day);

function strip(kept: DateKey[] = [], onToggle = vi.fn()) {
  render(
    <DayStrip
      habitTitle="Run"
      days={DAYS}
      today={TODAY}
      isDone={(day) => kept.includes(day)}
      isDueOnDay={dueMonWedFri}
      onToggle={onToggle}
    />,
  );
  return onToggle;
}

const dot = (name: string | RegExp) => screen.getByRole('button', { name }).firstElementChild!;

describe('the day strip with a schedule', () => {
  it('V4C-44 · ⭐ a day off is marked apart from a day missed', () => {
    strip();

    expect(dot(/Friday, September 25/)).toHaveAttribute('data-day-state', 'missed');
    expect(dot(/Saturday, September 26/)).toHaveAttribute('data-day-state', 'unscheduled');
  });

  it('V4C-45 · ⭐ and says which it is, out loud', () => {
    strip();

    expect(screen.getByRole('button', { name: 'Run — Friday, September 25, not done' })).toBeVisible();
    expect(screen.getByRole('button', { name: 'Run — Saturday, September 26, not due' })).toBeVisible();
  });

  it('V4C-46 · ⭐ a day off is still tappable, and a day kept on one reads as done', () => {
    const onToggle = strip(['2026-09-27']);

    expect(dot(/Sunday, September 27/)).toHaveAttribute('data-day-state', 'done');
    fireEvent.click(screen.getByRole('button', { name: /Saturday, September 26/ }));
    expect(onToggle).toHaveBeenCalledWith('2026-09-26');
  });

  it('V4C-47 · today is still the one with the ring when it is due', () => {
    strip();
    expect(dot(/Wednesday, September 30 \(today\)/)).toHaveAttribute('data-day-state', 'missed');
    expect(dot(/Wednesday, September 30 \(today\)/).className).toContain('border-accent');
  });
});
