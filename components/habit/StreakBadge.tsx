import { Flame } from 'lucide-react';
import type { Streak } from '@/store/selectors';

/**
 * A run in a row, shown only when there is one to show.
 *
 * A "0" on every newly added habit reads as a scolding rather than a nudge, so
 * nothing renders until the streak is at least one.
 *
 * **The unit matters.** For a habit kept a few times a week the run is counted
 * in weeks (v4 Block C), and a "3" that silently meant days there would be a
 * lie. The number keeps the flame; the unit is spelled out beside it, and in
 * full for a screen reader.
 */
export function StreakBadge({ streak }: { streak: Streak }) {
  if (streak.count < 1) return null;

  const plural = streak.count === 1 ? '' : 's';

  return (
    <span
      className="inline-flex shrink-0 items-center gap-0.5 text-xs font-extrabold text-badge-fg tabular-nums"
      aria-label={`${streak.count} ${streak.unit}${plural} in a row`}
    >
      <Flame className="h-3.5 w-3.5" strokeWidth={2.5} aria-hidden />
      {streak.count}
      {streak.unit === 'week' && <span aria-hidden>w</span>}
    </span>
  );
}
