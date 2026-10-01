import type { ReviewDay } from '@/store/selectors';
import type { DateKey } from '@/lib/types';

/**
 * A year of one habit, a square a day (v4 Block D).
 *
 * Weeks run **down** the columns, Monday at the top, the way code-hosting
 * activity graphs do — which is the only arrangement that fits 371 days across
 * a phone screen. At 375px the card's inner width is about 303px, so each of
 * the 53 columns gets roughly 5.7px. Too small to tap, which is why nothing
 * here is tappable: this is a picture of a year, and the seven-day strip on the
 * main list is where days are changed.
 *
 * Hidden from screen readers for the same reason the four-week grid is: 371
 * squares read aloud is noise, and the sentence above the grid says the same
 * thing in words.
 */
export function YearGrid({ weeks }: { weeks: { day: DateKey; state: ReviewDay }[][] }) {
  return (
    <div
      aria-hidden
      className="mt-3 grid grid-flow-col gap-px"
      style={{ gridTemplateRows: 'repeat(7, minmax(0, 1fr))' }}
    >
      {weeks.flat().map(({ day, state }) => (
        <span
          key={day}
          data-day={day}
          data-day-state={state}
          className={[
            'aspect-square rounded-[2px]',
            state === 'done'
              ? 'bg-accent'
              : state === 'missed'
                ? 'bg-ink-soft opacity-30'
                : state === 'unscheduled'
                  ? // A day off: fainter than a miss, and still visible, so a
                    // Mon/Wed/Fri habit's year reads as a rhythm rather than
                    // as four days of failure every week.
                    'bg-ink-soft opacity-10'
                  : // Before the habit existed, or still to come. Nothing at all:
                    // a habit made last week must not show a year of misses.
                    'bg-transparent',
          ].join(' ')}
        />
      ))}
    </div>
  );
}
