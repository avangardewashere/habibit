import { Flame } from 'lucide-react';

/**
 * Days in a row, shown only when there is a run to show.
 *
 * A "0" on every newly added habit reads as a scolding rather than a nudge, so
 * nothing renders until the streak is at least one day.
 */
export function StreakBadge({ streak }: { streak: number }) {
  if (streak < 1) return null;

  return (
    <span
      className="inline-flex shrink-0 items-center gap-0.5 text-xs font-extrabold text-badge-fg tabular-nums"
      aria-label={`${streak} day${streak === 1 ? '' : 's'} in a row`}
    >
      <Flame className="h-3.5 w-3.5" strokeWidth={2.5} aria-hidden />
      {streak}
    </span>
  );
}
