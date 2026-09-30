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
  isDueOnDay,
  onToggle,
}: {
  habitTitle: string;
  days: DateKey[];
  today: DateKey;
  isDone: (day: DateKey) => boolean;
  /** v4 Block C: was the habit meant to be kept that day? */
  isDueOnDay: (day: DateKey) => boolean;
  onToggle: (day: DateKey) => void;
}) {
  return (
    <div className="grid grid-cols-7 pb-1">
      {days.map((day) => {
        const done = isDone(day);
        const isToday = day === today;
        // A day it wasn't due is neither done nor missed. It stays tappable:
        // doing a habit on a day off is still doing it, and it counts.
        const resting = !done && !isDueOnDay(day);

        return (
          <button
            key={day}
            type="button"
            aria-pressed={done}
            aria-label={`${habitTitle} — ${formatDateKeyLong(day)}${isToday ? ' (today)' : ''}, ${done ? 'done' : resting ? 'not due' : 'not done'}`}
            onClick={() => onToggle(day)}
            className="grid h-11 touch-manipulation place-items-center rounded-card transition active:scale-90 focus-visible:outline-2 focus-visible:outline-offset-[-4px] focus-visible:outline-accent"
          >
            <span
              aria-hidden
              data-day-state={done ? 'done' : resting ? 'unscheduled' : 'missed'}
              className={[
                'block rounded-full transition-all duration-150',
                done
                  ? [isToday ? 'h-4 w-4' : 'h-3 w-3', 'bg-accent'].join(' ')
                  : resting
                    ? // Smaller, filled and quiet: clearly not an empty ring
                      // waiting to be filled, so a day off doesn't read as a miss.
                      'h-1.5 w-1.5 bg-ink-soft opacity-50'
                    : // A visible ring, not a faint tint: an empty dot still has to
                      // read as "not done" against both a white card and a plum one.
                      [
                        isToday ? 'h-4 w-4' : 'h-3 w-3',
                        'border-2 bg-transparent',
                        isToday ? 'border-accent' : 'border-ink-soft',
                      ].join(' '),
              ].join(' ')}
            />
          </button>
        );
      })}
    </div>
  );
}
