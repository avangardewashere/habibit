'use client';

import { EmptyState } from '@/components/ui/EmptyState';
import { useToday } from '@/lib/useToday';
import { useHabibit } from '@/store/HabibitProvider';
import { activeHabits, bestRunEver, checkIns, longestGoing, weekSummary } from '@/store/selectors';
import { HabitHistory } from './HabitHistory';
import { Highlights } from './Highlights';
import { WeekCard } from './WeekCard';

/**
 * The Progress tab (v5 Block B): this week, the headline numbers, and every
 * habit's history.
 *
 * Nothing on it is new arithmetic. The week counts through `reviewDay`, the
 * streaks through `habitStreak` and `bestEver` — the same functions the list
 * and its badges use — so no figure here can contradict one on Today.
 *
 * Waits for the client to know today's date, like everything else that
 * depends on it: the server can't know the reader's timezone.
 */
export function ProgressScreen() {
  const { state } = useHabibit();
  const today = useToday();
  const habits = activeHabits(state);

  return (
    <div>
      <header className="mb-6">
        <h1 id="screen-heading" tabIndex={-1} className="text-3xl font-extrabold tracking-tight text-ink outline-none">
          Progress
        </h1>
        <p className="mt-1 text-sm text-ink-soft">How your habits are going.</p>
      </header>

      {today === null ? null : habits.length === 0 ? (
        <div className="rounded-card border border-line bg-card">
          <EmptyState title="Nothing to show yet" hint="Add a habit on Today, and this fills up as you keep it." />
        </div>
      ) : (
        <div className="space-y-6">
          <WeekCard summary={weekSummary(state, today)} today={today} />
          <Highlights going={longestGoing(state, today)} best={bestRunEver(state, today)} checkIns={checkIns(state, today)} />
          <HabitHistory today={today} />
        </div>
      )}
    </div>
  );
}
