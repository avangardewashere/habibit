import { describe, expect, it } from 'vitest';
import { completionKey } from '@/lib/keys';
import type { DateKey, HabibitState } from '@/lib/types';
import { habitStreak } from './selectors';

/*
 * v4 Block C: streaks across a clock change.
 *
 * Runs under vitest.dst.config.mts, pinned to Santiago. The clocks go forward
 * at midnight on 2026-09-06 (that Sunday has no 00:00) and back on 2027-04-04
 * (that Sunday is 25 hours long). A streak walks day by day and a weekly
 * streak walks week by week, so both would be wrong by a day if either used
 * fixed 24-hour arithmetic — and the streak is the number people trust most.
 */

function state(schedule: string | null, kept: DateKey[]): HabibitState {
  return {
    habits: [
      {
        id: 'h1',
        title: 'Run',
        createdAt: '2026-01-01T00:00:00.000Z',
        updatedAt: '2026-01-01T00:00:00.000Z',
        archivedAt: null,
        position: null,
        schedule,
        deletedAt: null,
      },
    ],
    tasks: [],
    completions: Object.fromEntries(
      kept.map((day) => [completionKey('h1', day), { done: true, updatedAt: `${day}T15:00:00.000Z` }]),
    ),
  };
}

const streak = (s: HabibitState, today: DateKey) => habitStreak(s, s.habits[0], today);

describe('streaks on the days the clocks change', () => {
  it('V4C-60 · the run really is in a daylight-saving timezone', () => {
    expect(new Date(2026, 8, 6, 12).getTimezoneOffset()).toBe(180);
    expect(new Date(2026, 8, 6, 0).getHours()).toBe(1);
  });

  it('V4C-61 · ⭐ a daily run is not broken by the day that lost an hour', () => {
    const days: DateKey[] = ['2026-09-03', '2026-09-04', '2026-09-05', '2026-09-06', '2026-09-07'];
    expect(streak(state(null, days), '2026-09-07').count).toBe(5);
  });

  it('V4C-62 · ⭐ nor by the day that gained one', () => {
    const days: DateKey[] = ['2027-04-02', '2027-04-03', '2027-04-04', '2027-04-05'];
    expect(streak(state(null, days), '2027-04-05').count).toBe(4);
  });

  it('V4C-63 · ⭐ a Mon/Wed/Fri run steps over the changed Sunday like any other day off', () => {
    // Fri 4 Sep, then the clocks change on the Sunday, then Mon 7 and Wed 9.
    const days: DateKey[] = ['2026-09-02', '2026-09-04', '2026-09-07', '2026-09-09'];
    expect(streak(state('weekdays:0,2,4', days), '2026-09-09').count).toBe(4);
  });

  it('V4C-64 · ⭐ the weeks either side of a clock change are still whole weeks', () => {
    // Twice a week, in the week before the change, the week of it, and the week
    // after. A week counted from a fixed 7 × 24 hours would slide by a day here
    // and lose one of them.
    const days: DateKey[] = [
      '2026-08-31', '2026-09-02', // Mon 31 Aug – Sun 6 Sep is the week the clocks change
      '2026-09-05',
      '2026-08-24', '2026-08-26',
      '2026-09-08', '2026-09-10',
    ];
    expect(streak(state('weekly:2', days), '2026-09-10')).toEqual({ count: 3, unit: 'week' });
  });
});
