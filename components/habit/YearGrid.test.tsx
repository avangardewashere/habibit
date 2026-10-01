// @vitest-environment jsdom
import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import type { ReviewDay } from '@/store/selectors';
import type { DateKey } from '@/lib/types';
import { YearGrid } from './YearGrid';

/*
 * v4 Block D: the year grid is a picture, so what it has to get right is which
 * square means what. A day before the habit existed must not look like a day
 * it failed — otherwise a habit made last week opens on a wall of misses.
 */

function weeks(states: Partial<Record<ReviewDay, number>>) {
  const cells: { day: DateKey; state: ReviewDay }[] = [];
  let n = 0;
  for (const [state, count] of Object.entries(states) as [ReviewDay, number][]) {
    for (let i = 0; i < count; i += 1) cells.push({ day: `2026-01-${String(++n).padStart(2, '0')}`, state });
  }
  return [cells];
}

const classOf = (container: HTMLElement, day: string) =>
  container.querySelector(`[data-day="${day}"]`)!.className;

describe('the year grid', () => {
  it('V4D-40 · draws one square per day, tagged with what it means', () => {
    const { container } = render(<YearGrid weeks={weeks({ done: 2, missed: 1, unscheduled: 1, before: 1 })} />);

    expect(container.querySelectorAll('[data-day]')).toHaveLength(5);
    expect(container.querySelector('[data-day="2026-01-03"]')).toHaveAttribute('data-day-state', 'missed');
  });

  it('V4D-41 · ⭐ a day before the habit existed is blank, and a miss is not', () => {
    const { container } = render(<YearGrid weeks={weeks({ missed: 1, before: 1, future: 1 })} />);

    expect(classOf(container, '2026-01-01')).toContain('bg-ink-soft');
    expect(classOf(container, '2026-01-02')).toContain('bg-transparent');
    expect(classOf(container, '2026-01-03')).toContain('bg-transparent');
  });

  it('V4D-42 · ⭐ a day off is quieter than a miss, and a kept day is the accent', () => {
    const { container } = render(<YearGrid weeks={weeks({ done: 1, missed: 1, unscheduled: 1 })} />);

    expect(classOf(container, '2026-01-01')).toContain('bg-accent');
    expect(classOf(container, '2026-01-02')).toContain('opacity-30');
    expect(classOf(container, '2026-01-03')).toContain('opacity-10');
  });

  it('V4D-43 · 371 squares are a picture, not something to read out', () => {
    const { container } = render(<YearGrid weeks={weeks({ done: 3 })} />);
    expect(container.firstElementChild).toHaveAttribute('aria-hidden', 'true');
  });
});
