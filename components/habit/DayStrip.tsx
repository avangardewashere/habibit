'use client';

import { formatDateKeyLong } from '@/lib/date';
import type { DateKey } from '@/lib/types';

/**
 * The last seven days for one habit, oldest on the left and today on the right.
 *
 * It spans the full width of the card rather than sitting indented under the
 * title, and that is not cosmetic: seven targets across the card's inner ~333px
 * gives about 47px each, clearing the 44px comfortable-tap size. Indented under
 * the title they would be roughly 37px.
 *
 * Only days up to today are ever rendered, so there is no future day to tap by
 * mistake.
 */
export function DayStrip({
  habitTitle,
  days,
  today,
  isDone,
  onToggle,
}: {
  habitTitle: string;
  days: DateKey[];
  today: DateKey;
  isDone: (day: DateKey) => boolean;
  onToggle: (day: DateKey) => void;
}) {
  return (
    <div className="grid grid-cols-7 pb-1">
      {days.map((day) => {
        const done = isDone(day);
        const isToday = day === today;

        return (
          <button
            key={day}
            type="button"
            aria-pressed={done}
            aria-label={`${habitTitle} — ${formatDateKeyLong(day)}${isToday ? ' (today)' : ''}, ${done ? 'done' : 'not done'}`}
            onClick={() => onToggle(day)}
            className="grid h-11 touch-manipulation place-items-center rounded-card transition active:scale-90 focus-visible:outline-2 focus-visible:outline-offset-[-4px] focus-visible:outline-accent"
          >
            <span
              aria-hidden
              className={[
                'block rounded-full transition-all duration-150',
                isToday ? 'h-4 w-4' : 'h-3 w-3',
                done
                  ? 'bg-accent'
                  : // A visible ring, not a faint tint: an empty dot still has to
                    // read as "not done" against both a white card and a plum one.
                    ['border-2 bg-transparent', isToday ? 'border-accent' : 'border-ink-soft'].join(' '),
              ].join(' ')}
            />
          </button>
        );
      })}
    </div>
  );
}
