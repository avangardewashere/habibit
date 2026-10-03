'use client';

import { useState } from 'react';
import { Composer } from '@/components/ui/Composer';
import { EmptyState } from '@/components/ui/EmptyState';
import { ItemRow } from '@/components/ui/ItemRow';
import { SectionHeader } from '@/components/ui/SectionHeader';
import { useToday } from '@/lib/useToday';
import { useHabibit } from '@/store/HabibitProvider';
import { useUndo } from '@/store/UndoProvider';
import {
  activeHabits,
  archivedHabits,
  completedCount,
  dueHabits,
  habitStreak,
  isCompleted,
  isDue,
  recentDays,
  restingHabits,
} from '@/store/selectors';
import { resolveColour, resolveIcon } from '@/lib/look';
import { describeSchedule, parseSchedule } from '@/lib/schedule';
import type { Habit } from '@/lib/types';
import { ArchivedHabits } from './ArchivedHabits';
import { ArrangeList } from './ArrangeList';
import { DayStrip } from './DayStrip';
import { HabitIcon } from './HabitIcon';
import { ScheduleSheet } from './ScheduleSheet';
import { StreakBadge } from './StreakBadge';
import { WeekdayHeader } from './WeekdayHeader';

/**
 * Habits recur. Checking one writes a completion for *today's* key, so the same
 * habit is unchecked again tomorrow. That single difference from TaskSection is
 * the whole reason completions are stored per (habit, day).
 */
export function HabitSection() {
  const { state, dispatch } = useHabibit();
  const { offer } = useUndo();
  const today = useToday();
  const [arrangingRequested, setArranging] = useState(false);
  // Which habit's "how often?" sheet is open, by id — an id rather than the
  // habit itself, so the sheet always shows what the store currently holds.
  const [schedulingId, setScheduling] = useState<string | null>(null);

  const habits = activeHabits(state);
  const archived = archivedHabits(state);
  const done = today ? completedCount(state, today) : 0;
  // Looked up fresh each render: archiving or deleting the habit closes the sheet.
  const scheduling = habits.find((h) => h.id === schedulingId) ?? null;
  // Empty until the client knows the date, which keeps the server render honest.
  const days = today ? recentDays(today) : [];

  // There's nothing to arrange with fewer than two, e.g. after archiving down to one.
  const canArrange = habits.length >= 2;
  const arranging = arrangingRequested && canArrange;

  /*
   * Due today first, resting ones after. Before the client knows the date
   * nothing can be due, so the server renders the list in its plain order and
   * nothing jumps when the date arrives.
   */
  const rows = today ? dueHabits(state, today) : habits;
  const resting = today ? restingHabits(state, today) : [];

  const row = (habit: Habit, atRest: boolean) => {
    // What to draw, which is not the same as what is stored: a habit nobody has
    // chosen for still gets a colour from its id and an icon from its title
    // (v5 Block A, lib/look.ts).
    const colour = resolveColour(habit.colour, habit.id);
    const icon = resolveIcon(habit.icon, habit.title);

    return (
    <ItemRow
      key={habit.id}
      title={habit.title}
      colour={colour}
      glyph={icon ? <HabitIcon name={icon} className="h-4 w-4" /> : undefined}
      muted={atRest}
      checked={today ? isCompleted(state, habit.id, today) : false}
      onToggle={() => today && dispatch({ type: 'TOGGLE_COMPLETION', habitId: habit.id, dateKey: today })}
      onRemove={() => {
        dispatch({ type: 'REMOVE_HABIT', id: habit.id });
        offer(`Deleted “${habit.title}”`, () => dispatch({ type: 'RESTORE_HABIT', id: habit.id }));
      }}
      onRename={(title) => dispatch({ type: 'RENAME_HABIT', id: habit.id, title })}
      onSchedule={() => setScheduling(habit.id)}
      onArchive={() => dispatch({ type: 'ARCHIVE_HABIT', id: habit.id })}
      actionsLabel={`More actions for ${habit.title}`}
      renameLabel={`Rename habit: ${habit.title}`}
      scheduleLabel={`Edit ${habit.title}: its colour and icon, when it is due, and whether to remind you`}
      archiveLabel={`Archive ${habit.title}, keeping its history`}
      deleteLabel={`Delete ${habit.title} and its whole completion history`}
      trailing={today ? <StreakBadge streak={habitStreak(state, habit, today)} colour={colour} /> : null}
      below={
        today ? (
          <>
            {/* Says why the row is quiet, and what it is instead. */}
            {atRest && (
              <p className="px-4 pb-1 text-xs text-ink-soft">
                Not due today · {describeSchedule(parseSchedule(habit.schedule))}
              </p>
            )}
            <DayStrip
              habitTitle={habit.title}
              days={days}
              today={today}
              isDone={(day) => isCompleted(state, habit.id, day)}
              isDueOnDay={(day) => isDue(state, habit, day)}
              onToggle={(day) => dispatch({ type: 'TOGGLE_COMPLETION', habitId: habit.id, dateKey: day })}
            />
          </>
        ) : null
      }
    />
    );
  };

  return (
    <section className="mb-7">
      <SectionHeader
        title="Today's habits"
        trailing={
          habits.length > 0 ? (
            <span className="flex items-center gap-2">
              {canArrange && (
                <button
                  type="button"
                  onClick={() => setArranging(!arranging)}
                  aria-label={arranging ? 'Done arranging habits' : 'Arrange habits'}
                  // Keeps a 44px target without making the header row taller.
                  className="-my-3 inline-flex min-h-11 touch-manipulation items-center rounded-full px-3 text-xs font-extrabold text-ink transition active:scale-90 focus-visible:outline-2 focus-visible:outline-accent"
                >
                  {arranging ? 'Done' : 'Arrange'}
                </button>
              )}
              {/*
                * Out of what is due **today**, not out of everything you keep
                * (v4 Block C). A Monday-only habit shouldn't make every
                * Tuesday read as unfinished. With nothing due there is no
                * fraction to show, and "0/0" would only look broken.
                */}
              {rows.length > 0 && (
                <span
                  className={[
                    'rounded-full px-2 py-0.5 text-xs font-extrabold tabular-nums transition-colors',
                    done === rows.length
                      ? 'bg-badge-done-bg text-badge-done-fg'
                      : 'bg-badge-bg text-badge-fg',
                  ].join(' ')}
                >
                  {done}/{rows.length}
                </span>
              )}
            </span>
          ) : null
        }
      />

      <div className="overflow-hidden rounded-card border border-line bg-card">
        {habits.length === 0 ? (
          archived.length > 0 ? (
            <EmptyState title="Nothing on today's list" hint="Your archived habits are below, or start a new one." />
          ) : (
            <EmptyState
              title="No habits yet"
              hint="Start with one small thing. It resets every morning."
            />
          )
        ) : arranging ? (
          <ArrangeList
            habits={habits}
            onMove={(id, toIndex) => dispatch({ type: 'MOVE_HABIT', id, toIndex })}
          />
        ) : (
          <>
            {today && <WeekdayHeader days={days} today={today} />}

            <ul className="divide-y divide-line">
              {rows.map((habit) => row(habit, false))}
              {/*
               * Habits that aren't due today, below the rest and in a quieter
               * colour (your choice, v4 Block C). Not hidden: a habit you can't
               * see is one you forget you have, and it stays tappable for the
               * day you do it anyway.
               */}
              {resting.map((habit) => row(habit, true))}
            </ul>
          </>
        )}

        {/* Adding waits while arranging, so the list you're arranging doesn't change under you. */}
        {!arranging && (
          <Composer
            placeholder="Add a habit..."
            addLabel="Add habit"
            onAdd={(titles) =>
              titles.forEach((title) => dispatch({ type: 'ADD_HABIT', title }))
            }
          />
        )}
      </div>

      <ArchivedHabits
        habits={archived}
        onUnarchive={(id) => dispatch({ type: 'UNARCHIVE_HABIT', id })}
      />

      {scheduling && (
        <ScheduleSheet
          habit={scheduling}
          today={today}
          onChoose={(schedule) => dispatch({ type: 'SET_SCHEDULE', id: scheduling.id, schedule })}
          onChooseLook={(icon, colour) => dispatch({ type: 'SET_LOOK', id: scheduling.id, icon, colour })}
          onClose={() => setScheduling(null)}
        />
      )}
    </section>
  );
}
