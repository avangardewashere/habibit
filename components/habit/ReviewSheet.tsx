'use client';

import { Flame, X } from 'lucide-react';
import { useEffect, useId, useRef } from 'react';
import { formatDateKeyShort, weekdayInitial } from '@/lib/date';
import type { DateKey, Habit } from '@/lib/types';
import { useHabibit } from '@/store/HabibitProvider';
import { activeHabits, habitReview, reviewWeeks, type HabitReview } from '@/store/selectors';

/**
 * The last four weeks, habit by habit: a calendar you can read, not tap.
 *
 * A sheet over the page rather than its own address. The service worker from
 * v2 Block F caches the one page this app has, so a sheet works with no signal
 * for free, where a second page would need its own offline handling.
 *
 * Reading only. Past days stay editable in the 7-day strip on the main list, so
 * a misplaced thumb here can't rewrite your history.
 */
export function ReviewSheet({ today, onClose }: { today: DateKey; onClose: () => void }) {
  const { state } = useHabibit();
  const habits = activeHabits(state);
  const titleId = useId();
  const closeRef = useRef<HTMLButtonElement>(null);
  const weeks = reviewWeeks(today);
  const from = weeks[0][0];

  useEffect(() => {
    closeRef.current?.focus();
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') onClose();
    }
    document.addEventListener('keydown', onKeyDown);
    // The sheet covers the page and scrolls itself; letting the page behind it
    // scroll too would drag the list around under the sheet.
    const { overflow } = document.body.style;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      document.body.style.overflow = overflow;
    };
  }, [onClose]);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
      className="fixed inset-0 z-40 overflow-y-auto overscroll-contain bg-surface px-5 pb-10 pt-5"
    >
      <div className="mx-auto w-full max-w-md">
        <div className="mb-5 flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h2 id={titleId} className="text-2xl font-extrabold tracking-tight text-ink">
              Last 4 weeks
            </h2>
            <p className="mt-0.5 text-sm text-ink-soft">
              {formatDateKeyShort(from)} – {formatDateKeyShort(today)}
            </p>
          </div>
          <button
            ref={closeRef}
            type="button"
            onClick={onClose}
            aria-label="Close review"
            className="grid h-11 w-11 shrink-0 touch-manipulation place-items-center rounded-full border border-line bg-card text-ink-soft transition active:scale-90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
          >
            <X className="h-5 w-5" strokeWidth={2.5} />
          </button>
        </div>

        {habits.length === 0 ? (
          <p className="rounded-card border border-line bg-card px-4 py-7 text-center text-sm text-ink-soft">
            Nothing to review yet. Add a habit and come back in a few days.
          </p>
        ) : (
          <div className="space-y-3">
            {habits.map((habit) => (
              <HabitCalendar key={habit.id} habit={habit} review={habitReview(state, habit, today)} today={today} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function HabitCalendar({ habit, review, today }: { habit: Habit; review: HabitReview; today: DateKey }) {
  const { days, kept, possible, best } = review;

  return (
    <section className="rounded-card border border-line bg-card p-4">
      <h3 className="break-words text-[15px] font-bold leading-snug text-ink">{habit.title}</h3>

      {/*
       * The numbers in a sentence, for a screen reader, since the squares
       * themselves are a picture. Everything below is hidden from it.
       */}
      <p className="mt-0.5 text-sm text-ink-soft">
        Kept {kept} of {possible} {possible === 1 ? 'day' : 'days'}
        {best > 0 && (
          <span className="ml-2 inline-flex items-center gap-1 align-middle font-bold text-ink">
            <Flame aria-hidden className="h-3.5 w-3.5" strokeWidth={2.5} />
            {best} best
          </span>
        )}
      </p>

      <div aria-hidden className="mt-3">
        <div className="mb-1 grid grid-cols-7 gap-1">
          {days[0].map((cell) => (
            <span key={cell.day} className="text-center text-[11px] font-extrabold uppercase text-ink-soft">
              {weekdayInitial(cell.day)}
            </span>
          ))}
        </div>

        <div className="grid grid-cols-7 gap-1">
          {days.flat().map(({ day, state }) => (
            <span key={day} className="grid h-7 place-items-center">
              <span
                data-day={day}
                data-day-state={state}
                className={[
                  'block rounded-full transition-colors',
                  day === today ? 'h-5 w-5 ring-2 ring-accent ring-offset-1 ring-offset-card' : 'h-4 w-4',
                  state === 'done'
                    ? 'bg-accent'
                    : state === 'missed'
                      ? 'border-2 border-ink-soft'
                      : // Before it existed, or still to come. A dimmed outline, not a
                        // miss: it keeps the grid readable without claiming you failed.
                        'border-2 border-ink-soft opacity-25',
                ].join(' ')}
              />
            </span>
          ))}
        </div>
      </div>
    </section>
  );
}
