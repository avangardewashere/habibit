// @vitest-environment jsdom
import { fireEvent, render, screen, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { STORAGE_KEY } from '@/lib/storage';
import type { DateKey, HabibitState } from '@/lib/types';
import { HabibitProvider } from '@/store/HabibitProvider';
import { ReviewButton } from './ReviewButton';

/*
 * Today is pinned, because a review of "the last four weeks" is meaningless
 * without knowing which four. The suite runs in UTC+8 (see vitest.config.ts).
 */
const TODAY = new Date('2026-09-20T09:00:00+08:00');

function habit(id: string, title: string, createdAt: string, position: string) {
  return { id, title, createdAt, updatedAt: createdAt, archivedAt: null, deletedAt: null, position };
}

function stored(): HabibitState {
  const ticks: DateKey[] = ['2026-09-15', '2026-09-16', '2026-09-17', '2026-09-19'];
  return {
    habits: [
      habit('h1', 'Drink water', '2026-08-20T02:00:00.000Z', 'V'),
      // Made four days ago, so most of the calendar is before it existed.
      habit('h2', 'Read 10 pages', '2026-09-16T02:00:00.000Z', 'l'),
      { ...habit('h3', 'Old thing', '2026-08-20T02:00:00.000Z', 'x'), archivedAt: '2026-09-01T02:00:00.000Z' },
    ],
    tasks: [],
    completions: Object.fromEntries(
      ticks.map((day) => [`h1::${day}`, { done: true, updatedAt: `${day}T08:00:00.000Z` }]),
    ) as HabibitState['completions'],
  };
}

function open() {
  render(
    <HabibitProvider>
      <ReviewButton />
    </HabibitProvider>,
  );
  fireEvent.click(screen.getByRole('button', { name: 'Review the last 4 weeks' }));
  return screen.getByRole('dialog', { name: 'Last 4 weeks' });
}

const squares = (dialog: HTMLElement, title: string) => {
  const card = within(dialog).getByRole('heading', { name: title }).closest('section')!;
  return [...card.querySelectorAll('[data-day-state]')];
};

beforeEach(() => {
  vi.useFakeTimers({ shouldAdvanceTime: true });
  vi.setSystemTime(TODAY);
  localStorage.clear();
  localStorage.setItem(STORAGE_KEY, JSON.stringify({ version: 2, state: stored() }));
});

describe('the review', () => {
  it('V3C-20 · opens from the header button, with focus on Close', () => {
    const dialog = open();
    expect(dialog).toBeInTheDocument();
    expect(within(dialog).getByRole('button', { name: 'Close review' })).toHaveFocus();
    expect(within(dialog).getByText('24 Aug – 20 Sept')).toBeInTheDocument();
  });

  it('V3C-21 · Escape closes it and puts focus back on the button', () => {
    open();
    fireEvent.keyDown(document, { key: 'Escape' });

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Review the last 4 weeks' })).toHaveFocus();
    // The page behind can scroll again.
    expect(document.body.style.overflow).toBe('');
  });

  it('V3C-22 · ⭐ says how many days were kept out of the days that counted, and the best run', () => {
    const dialog = open();

    // An old habit: all 28 days could have been kept, and four were.
    expect(within(dialog).getByText(/Kept 4 of 28 days/)).toBeInTheDocument();
    // Made on the 16th: only the 16th to today counted, and none were kept.
    expect(within(dialog).getByText(/Kept 0 of 5 days/)).toBeInTheDocument();
    expect(within(dialog).getByText('3 best')).toBeInTheDocument();
  });

  it('V3C-23 · ⭐ days before a habit existed are blank, not missed', () => {
    const dialog = open();
    const states = squares(dialog, 'Read 10 pages').map((s) => s.getAttribute('data-day-state'));

    expect(states).toHaveLength(28);
    expect(states.filter((s) => s === 'before')).toHaveLength(23);
    expect(states.filter((s) => s === 'missed')).toHaveLength(5);
    expect(states).not.toContain('future');
    // The 15th is the day before it was made; the 16th is its first day.
    expect(squares(dialog, 'Read 10 pages').find((s) => s.getAttribute('data-day') === '2026-09-15'))
      .toHaveAttribute('data-day-state', 'before');
    expect(squares(dialog, 'Read 10 pages').find((s) => s.getAttribute('data-day') === '2026-09-16'))
      .toHaveAttribute('data-day-state', 'missed');
  });

  it('V3C-24 · ⭐ nothing in the review can change your history', () => {
    const dialog = open();
    // One button, and it closes the sheet. No day is tappable.
    expect(within(dialog).getAllByRole('button').map((b) => b.getAttribute('aria-label'))).toEqual(['Close review']);
  });

  it('V3C-25 · archived habits are left out', () => {
    const dialog = open();
    expect(within(dialog).queryByRole('heading', { name: 'Old thing' })).not.toBeInTheDocument();
    expect(within(dialog).getAllByRole('heading', { level: 3 })).toHaveLength(2);
  });
});
