// @vitest-environment jsdom
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import type { WeekSummary } from '@/store/selectors';
import { WeekCard } from './WeekCard';

/*
 * v5 Block B: the week chart draws three different kinds of day three
 * different ways — because a rest day is not a bad day, and a day still to
 * come has nothing to say yet.
 */

const TODAY = '2026-10-07';
const summary: WeekSummary = {
  days: [
    { day: '2026-10-05', due: 4, done: 4, future: false },
    { day: '2026-10-06', due: 0, done: 0, future: false },
    { day: '2026-10-07', due: 4, done: 1, future: false },
    { day: '2026-10-08', due: 0, done: 0, future: true },
    { day: '2026-10-09', due: 0, done: 0, future: true },
    { day: '2026-10-10', due: 0, done: 0, future: true },
    { day: '2026-10-11', due: 0, done: 0, future: true },
  ],
  due: 8,
  done: 5,
};

const bar = (container: HTMLElement, day: string) =>
  container.querySelector(`[data-week-day="${day}"] [data-bar]`) as HTMLElement | null;

describe('the week card', () => {
  it('V5B-41 · ⭐ the total and the share, in words', () => {
    render(<WeekCard summary={summary} today={TODAY} />);
    expect(screen.getByText('63% kept')).toBeInTheDocument();
    expect(screen.getByText(/Monday, October 5: 4 of 4; Tuesday, October 6: nothing due; Wednesday, October 7: 1 of 4/))
      .toBeInTheDocument();
  });

  it('V5B-42 · ⭐ a day so far is filled to its share; a full day is marked full', () => {
    const { container } = render(<WeekCard summary={summary} today={TODAY} />);
    expect(bar(container, '2026-10-05')).toHaveAttribute('data-bar', 'full');
    expect(bar(container, '2026-10-05')!.style.height).toBe('100%');
    expect(bar(container, '2026-10-07')).toHaveAttribute('data-bar', 'part');
    expect(bar(container, '2026-10-07')!.style.height).toBe('25%');
  });

  it('V5B-43 · ⭐ a rest day is a rest day, not an empty bar', () => {
    const { container } = render(<WeekCard summary={summary} today={TODAY} />);
    expect(bar(container, '2026-10-06')).toHaveAttribute('data-bar', 'rest');
  });

  it('V5B-44 · days still to come have no bar at all', () => {
    const { container } = render(<WeekCard summary={summary} today={TODAY} />);
    for (const day of ['2026-10-08', '2026-10-11']) expect(bar(container, day), day).toBeNull();
  });

  it('V5B-45 · a week with nothing due yet says so instead of "0 / 0"', () => {
    const empty: WeekSummary = { ...summary, due: 0, done: 0 };
    render(<WeekCard summary={empty} today={TODAY} />);
    expect(screen.getByText('Nothing due yet this week')).toBeInTheDocument();
    expect(screen.queryByText(/% kept/)).not.toBeInTheDocument();
  });

  it('V5B-46 · the bars grow in, unless the device asks for less motion', () => {
    const { container } = render(<WeekCard summary={summary} today={TODAY} />);
    expect(bar(container, '2026-10-05')!.className).toMatch(/animate-grow/);
    expect(bar(container, '2026-10-05')!.className).toMatch(/motion-reduce:animate-none/);
  });
});
