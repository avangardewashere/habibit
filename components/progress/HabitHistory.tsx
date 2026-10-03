'use client';

import { Flame } from 'lucide-react';
import { useState } from 'react';
import { HabitIcon } from '@/components/habit/HabitIcon';
import { YearGrid } from '@/components/habit/YearGrid';
import { HUE_BG, HUE_TEXT } from '@/components/ui/hue';
import { describeSpan, formatDateRange, weekdayInitial } from '@/lib/date';
import { resolveColour, resolveIcon, type HabitColour } from '@/lib/look';
import type { DateKey, Habit } from '@/lib/types';
import { useHabibit } from '@/store/HabibitProvider';
import {
  activeHabits,
  bestEver,
  habitReview,
  reviewWeeks,
  sinceYouStarted,
  YEAR_WEEKS,
  type HabitHistory as History,
  type HabitReview,
  type Streak,
} from '@/store/selectors';

/** How much history is shown at once. */
type Range = 'month' | 'year';

/**
 * Habit by habit, a calendar you can read but not tap: the last four weeks, or
 * the last year.
 *
 * Moved here from the review sheet in v5 Block B, where it was reached through
 * a calendar button in the header; it is now the bottom half of the Progress
 * tab. Each habit is drawn in its own colour from Block A, so a page of
 * calendars reads habit by habit instead of as one coral blur.
 *
 * Reading only, as before. Past days stay editable in the seven-day strip on
 * Today, so a misplaced thumb here can't rewrite your history.
 */
export function HabitHistory({ today }: { today: DateKey }) {
  const { state } = useHabibit();
  const habits = activeHabits(state);
  const [range, setRange] = useState<Range>('month');
  const weeks = range === 'year' ? YEAR_WEEKS : 4;
  const from = reviewWeeks(today, weeks)[0][0];

  return (
    <section aria-labelledby="history-heading">
      <div className="mb-2 flex items-end justify-between gap-3">
        <div className="min-w-0">
          <h2 id="history-heading" className="text-lg font-extrabold tracking-tight text-ink">
            {range === 'year' ? 'Last year' : 'Last 4 weeks'}
          </h2>
          <p className="text-sm text-ink-soft">{formatDateRange(from, today)}</p>
        </div>

        {/*
          * Four weeks or a year. Two buttons rather than a dropdown: there are
          * only ever two, and a dropdown would hide one of them behind a tap.
          */}
        <div className="flex shrink-0 gap-1" role="group" aria-label="How much history to show">
          {(['month', 'year'] as const).map((option) => (
            <button
              key={option}
              type="button"
              onClick={() => setRange(option)}
              aria-pressed={range === option}
              className={[
                'min-h-11 touch-manipulation rounded-full border px-4 text-xs font-extrabold transition active:scale-90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent',
                range === option
                  ? 'border-badge-done-bg bg-badge-done-bg text-badge-done-fg'
                  : 'border-ink-soft bg-card text-ink',
              ].join(' ')}
            >
              {option === 'month' ? '4 weeks' : 'Year'}
            </button>
          ))}
        </div>
      </div>

      <div className="space-y-3">
        {habits.map((habit) => (
          <HabitCalendar
            key={habit.id}
            habit={habit}
            review={habitReview(state, habit, today, weeks)}
            today={today}
            range={range}
            best={bestEver(state, habit, today)}
            history={sinceYouStarted(state, habit, today)}
          />
        ))}
      </div>
    </section>
  );
}

function HabitCalendar({
  habit,
  review,
  today,
  range,
  best: allTime,
  history,
}: {
  habit: Habit;
  review: HabitReview;
  today: DateKey;
  range: Range;
  /** The best run ever, which is usually older than the window being shown. */
  best: Streak;
  history: History;
}) {
  const { days, kept, possible, best, unit } = review;
  const colour: HabitColour = resolveColour(habit.colour, habit.id);
  const icon = resolveIcon(habit.icon, habit.title);

  return (
    <section className="rounded-card border border-line bg-card p-4">
      <div className="flex items-center gap-2.5">
        {/* The habit's face, as on Today, so the two screens are visibly about the same thing. */}
        <span aria-hidden className={`grid h-7 w-7 shrink-0 place-items-center rounded-full ${HUE_BG[colour]} text-on-hue`}>
          {icon ? <HabitIcon name={icon} className="h-4 w-4" /> : null}
        </span>
        <h3 className="min-w-0 break-words text-[15px] font-bold leading-snug text-ink">{habit.title}</h3>
      </div>

      {/*
       * The numbers in a sentence, for a screen reader, since the squares
       * themselves are a picture. Everything below is hidden from it.
       */}
      <p className="mt-1.5 text-sm text-ink-soft">
        Kept {kept} of {possible} {unit}
        {possible === 1 ? '' : 's'}
        {best > 0 && (
          <span className={`ml-2 inline-flex items-center gap-1 align-middle font-bold ${HUE_TEXT[colour]}`}>
            <Flame aria-hidden className="h-3.5 w-3.5" strokeWidth={2.5} />
            {best} best
          </span>
        )}
      </p>

      {/*
       * v4 Block D. Only in the year view: in the four-week one these two lines
       * would be about a stretch of time the squares above don't show, which
       * reads as a contradiction rather than as context.
       */}
      {range === 'year' && (
        <p className="mt-1 text-sm text-ink-soft">
          Best ever {allTime.count} {allTime.unit}
          {allTime.count === 1 ? '' : 's'} in a row · kept {history.times}{' '}
          {history.times === 1 ? 'time' : 'times'} over {describeSpan(history.days)}
        </p>
      )}

      {range === 'year' ? (
        <YearGrid weeks={days} colour={colour} />
      ) : (
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
                      ? HUE_BG[colour]
                      : state === 'missed'
                        ? 'border-2 border-ink-soft'
                        : state === 'unscheduled'
                          ? // A day the habit wasn't due. Marked differently from a
                            // day that hadn't started and from one still to come: a
                            // Mon/Wed/Fri habit didn't fail on Thursday, and the
                            // calendar shouldn't leave room to read it that way.
                            'scale-[0.35] rounded-full bg-ink-soft opacity-60'
                          : // Before it existed, or still to come. A dimmed outline, not a
                            // miss: it keeps the grid readable without claiming you failed.
                            'border-2 border-ink-soft opacity-25',
                  ].join(' ')}
                />
              </span>
            ))}
          </div>
        </div>
      )}
    </section>
  );
}
