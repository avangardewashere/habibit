'use client';

import { useState } from 'react';
import { Composer } from '@/components/ui/Composer';
import { EmptyState } from '@/components/ui/EmptyState';
import { ItemRow } from '@/components/ui/ItemRow';
import { SectionHeader } from '@/components/ui/SectionHeader';
import { useToday } from '@/lib/useToday';
import { useHabibit } from '@/store/HabibitProvider';
import {
  activeHabits,
  archivedHabits,
  completedCount,
  currentStreak,
  isCompleted,
  recentDays,
} from '@/store/selectors';
import { ArchivedHabits } from './ArchivedHabits';
import { ArrangeList } from './ArrangeList';
import { DayStrip } from './DayStrip';
import { StreakBadge } from './StreakBadge';
import { WeekdayHeader } from './WeekdayHeader';

/**
 * Habits recur. Checking one writes a completion for *today's* key, so the same
 * habit is unchecked again tomorrow. That single difference from TaskSection is
 * the whole reason completions are stored per (habit, day).
 */
export function HabitSection() {
  const { state, dispatch } = useHabibit();
  const today = useToday();
  const [arrangingRequested, setArranging] = useState(false);

  const habits = activeHabits(state);
  const archived = archivedHabits(state);
  const done = today ? completedCount(state, today) : 0;
  // Empty until the client knows the date, which keeps the server render honest.
  const days = today ? recentDays(today) : [];

  // There's nothing to arrange with fewer than two, e.g. after archiving down to one.
  const canArrange = habits.length >= 2;
  const arranging = arrangingRequested && canArrange;

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
              <span
                className={[
                  'rounded-full px-2 py-0.5 text-xs font-extrabold tabular-nums transition-colors',
                  done === habits.length
                    ? 'bg-badge-done-bg text-badge-done-fg'
                    : 'bg-badge-bg text-badge-fg',
                ].join(' ')}
              >
                {done}/{habits.length}
              </span>
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
              {habits.map((habit) => (
                <ItemRow
                  key={habit.id}
                  title={habit.title}
                  checked={today ? isCompleted(state, habit.id, today) : false}
                  onToggle={() =>
                    today && dispatch({ type: 'TOGGLE_COMPLETION', habitId: habit.id, dateKey: today })
                  }
                  onRemove={() => dispatch({ type: 'REMOVE_HABIT', id: habit.id })}
                  onRename={(title) => dispatch({ type: 'RENAME_HABIT', id: habit.id, title })}
                  onArchive={() => dispatch({ type: 'ARCHIVE_HABIT', id: habit.id })}
                  actionsLabel={`More actions for ${habit.title}`}
                  renameLabel={`Rename habit: ${habit.title}`}
                  archiveLabel={`Archive ${habit.title}, keeping its history`}
                  deleteLabel={`Delete ${habit.title} and its whole completion history`}
                  trailing={today ? <StreakBadge streak={currentStreak(state, habit.id, today)} /> : null}
                  below={
                    today ? (
                      <DayStrip
                        habitTitle={habit.title}
                        days={days}
                        today={today}
                        isDone={(day) => isCompleted(state, habit.id, day)}
                        onToggle={(day) =>
                          dispatch({ type: 'TOGGLE_COMPLETION', habitId: habit.id, dateKey: day })
                        }
                      />
                    ) : null
                  }
                />
              ))}
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
    </section>
  );
}
