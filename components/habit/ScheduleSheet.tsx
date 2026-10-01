'use client';

import { X } from 'lucide-react';
import { useEffect, useId, useRef } from 'react';
import { mondayIndex } from '@/lib/date';
import {
  DAILY,
  MOST_TIMES_A_WEEK,
  describeSchedule,
  parseSchedule,
  shortWeekdayName,
  timesAWeek,
  weekdayName,
  weekdays,
  type Schedule,
  type Weekday,
} from '@/lib/schedule';
import type { DateKey, Habit } from '@/lib/types';

/**
 * How often one habit is meant to be kept.
 *
 * A sheet over the page, like the review (v3 Block C): the service worker
 * caches the one page this app has, so a sheet keeps working with no signal
 * where a second page would need its own offline handling.
 *
 * There is no Save. Every choice is written as it is made — the same as
 * renaming, ticking and archiving — so the sheet can be closed, or the app
 * killed, without a half-made decision hanging around. Nothing here changes
 * today's list yet; that is Block C.
 */
export function ScheduleSheet({
  habit,
  today,
  onChoose,
  onClose,
}: {
  habit: Habit;
  /** Used to pick a sensible first day when switching to "certain days". */
  today: DateKey | null;
  onChoose: (schedule: Schedule) => void;
  onClose: () => void;
}) {
  const schedule = parseSchedule(habit.schedule);
  const titleId = useId();
  const closeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    closeRef.current?.focus();
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') onClose();
    }
    document.addEventListener('keydown', onKeyDown);
    const { overflow } = document.body.style;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      document.body.style.overflow = overflow;
    };
  }, [onClose]);

  const chosenDays = schedule.kind === 'weekdays' ? schedule.days : [];
  const chosenTimes = schedule.kind === 'weekly' ? schedule.times : 0;

  /** Turning a day on or off. The last one cannot be turned off: a habit due on
   *  no days at all would simply never appear again. */
  function toggleDay(day: Weekday) {
    const on = chosenDays.includes(day);
    if (on && chosenDays.length === 1) return;
    onChoose(weekdays(on ? chosenDays.filter((d) => d !== day) : [...chosenDays, day]));
  }

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
            <h2 id={titleId} className="break-words text-2xl font-extrabold tracking-tight text-ink">
              How often?
            </h2>
            <p className="mt-0.5 break-words text-sm text-ink-soft">
              {habit.title} — {describeSchedule(schedule)}
            </p>
          </div>
          <button
            ref={closeRef}
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="grid h-11 w-11 shrink-0 touch-manipulation place-items-center rounded-full border border-line bg-card text-ink-soft transition active:scale-90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
          >
            <X className="h-5 w-5" strokeWidth={2.5} />
          </button>
        </div>

        <div className="space-y-2">
          <Choice
            label="Every day"
            hint="The usual. Due every single day."
            checked={schedule.kind === 'daily'}
            onSelect={() => onChoose(DAILY)}
          />

          <Choice
            label="Certain days"
            hint="Mon, Wed and Fri, say."
            checked={schedule.kind === 'weekdays'}
            onSelect={() => onChoose(weekdays(startingDays(today)))}
          >
            <div className="mt-3 grid grid-cols-7 gap-1">
              {([0, 1, 2, 3, 4, 5, 6] as Weekday[]).map((day) => {
                const on = chosenDays.includes(day);
                return (
                  <button
                    key={day}
                    type="button"
                    onClick={() => toggleDay(day)}
                    aria-pressed={on}
                    aria-label={weekdayName(day)}
                    className={[
                      'min-h-11 touch-manipulation rounded-full border text-xs font-extrabold transition active:scale-90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent',
                      /*
                       * The all-done badge's colours, not the accent's. These
                       * are letters, so they need 4.5:1, and white on the light
                       * accent measures 3.39:1 — enough for the tick glyph it
                       * was chosen for, not for text (lib/contrast.test.ts).
                       */
                      on
                        ? 'border-badge-done-bg bg-badge-done-bg text-badge-done-fg'
                        : 'border-ink-soft bg-card text-ink',
                    ].join(' ')}
                  >
                    {shortWeekdayName(day).slice(0, 1)}
                  </button>
                );
              })}
            </div>
          </Choice>

          <Choice
            label="A few times a week"
            hint="Any days you like — three runs, whenever they happen."
            checked={schedule.kind === 'weekly'}
            onSelect={() => onChoose(timesAWeek(chosenTimes || 3))}
          >
            <div className="mt-3 flex flex-wrap gap-1">
              {Array.from({ length: MOST_TIMES_A_WEEK }, (_, i) => i + 1).map((times) => (
                <button
                  key={times}
                  type="button"
                  onClick={() => onChoose(timesAWeek(times))}
                  aria-pressed={times === chosenTimes}
                  aria-label={times === 1 ? 'Once a week' : `${times} times a week`}
                  className={[
                    'min-h-11 min-w-11 touch-manipulation rounded-full border px-3 text-xs font-extrabold tabular-nums transition active:scale-90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent',
                    times === chosenTimes
                      ? 'border-badge-done-bg bg-badge-done-bg text-badge-done-fg'
                      : 'border-ink-soft bg-card text-ink',
                  ].join(' ')}
                >
                  {times}×
                </button>
              ))}
            </div>
          </Choice>
        </div>

        <p className="mt-5 text-sm text-ink-soft">
          Your history is kept whatever you choose here, and changing it later never rewrites the past.
        </p>
      </div>
    </div>
  );
}

/** The days a habit starts on when you first say "certain days": today's. */
function startingDays(today: DateKey | null): Weekday[] {
  return [today ? (mondayIndex(today) as Weekday) : 0];
}

/**
 * One option, with whatever it needs to be spelt out underneath.
 *
 * A real radio, not a styled button: a radio group is what a screen reader
 * announces as "one of three", and the arrow keys move between them for free.
 */
function Choice({
  label,
  hint,
  checked,
  onSelect,
  children,
}: {
  label: string;
  hint: string;
  checked: boolean;
  onSelect: () => void;
  children?: React.ReactNode;
}) {
  return (
    <div
      className={[
        'rounded-card border p-4 transition-colors',
        checked ? 'border-accent bg-card' : 'border-line bg-card',
      ].join(' ')}
    >
      <label className="flex min-h-11 items-start gap-3">
        <input
          type="radio"
          name="habit-schedule"
          checked={checked}
          onChange={onSelect}
          className="mt-1 h-5 w-5 shrink-0 accent-[var(--color-accent)]"
        />
        <span className="min-w-0">
          <span className="block text-[15px] font-bold leading-snug text-ink">{label}</span>
          <span className="mt-0.5 block text-sm text-ink-soft">{hint}</span>
        </span>
      </label>
      {checked && children}
    </div>
  );
}
