import { weekdayInitial } from '@/lib/date';
import type { DateKey } from '@/lib/types';

/**
 * The weekday letters, once per list rather than under every habit. Repeating
 * them per row costs height on every habit and says the same thing seven times.
 *
 * Shares the 7-column grid with DayStrip and lives inside the same card, so the
 * columns line up without having to fight the card's padding.
 */
export function WeekdayHeader({ days, today }: { days: DateKey[]; today: DateKey }) {
  return (
    <div className="grid grid-cols-7 border-b border-line pt-2 pb-1" aria-hidden>
      {days.map((day) => (
        <span
          key={day}
          className={[
            'text-center text-[11px] font-extrabold uppercase',
            day === today ? 'text-accent' : 'text-ink-soft',
          ].join(' ')}
        >
          {weekdayInitial(day)}
        </span>
      ))}
    </div>
  );
}
