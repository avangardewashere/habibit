'use client';

import { Composer } from '@/components/ui/Composer';
import { EmptyState } from '@/components/ui/EmptyState';
import { ItemRow } from '@/components/ui/ItemRow';
import { SectionHeader } from '@/components/ui/SectionHeader';
import { useToday } from '@/lib/useToday';
import { useHabibit } from '@/store/HabibitProvider';
import { activeHabits, completedCount, isCompleted } from '@/store/selectors';

/**
 * Habits recur. Checking one writes a completion for *today's* key, so the same
 * habit is unchecked again tomorrow. That single difference from TaskSection is
 * the whole reason completions are stored per (habit, day).
 */
export function HabitSection() {
  const { state, dispatch } = useHabibit();
  const today = useToday();

  const habits = activeHabits(state);
  const done = today ? completedCount(state, today) : 0;

  return (
    <section className="mb-7">
      <SectionHeader
        title="Today's habits"
        trailing={
          habits.length > 0 ? (
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
          ) : null
        }
      />

      <div className="overflow-hidden rounded-card border border-line bg-card">
        {habits.length === 0 ? (
          <EmptyState
            title="No habits yet"
            hint="Start with one small thing. It resets every morning."
          />
        ) : (
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
                removeLabel={`Delete habit: ${habit.title}`}
                confirmLabel={`Confirm deleting ${habit.title} and its whole completion history`}
              />
            ))}
          </ul>
        )}

        <Composer
          placeholder="Add a habit..."
          addLabel="Add habit"
          onAdd={(titles) =>
            titles.forEach((title) => dispatch({ type: 'ADD_HABIT', title }))
          }
        />
      </div>
    </section>
  );
}
