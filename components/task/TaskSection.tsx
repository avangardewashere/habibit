'use client';

import { Composer } from '@/components/ui/Composer';
import { EmptyState } from '@/components/ui/EmptyState';
import { ItemRow } from '@/components/ui/ItemRow';
import { SectionHeader } from '@/components/ui/SectionHeader';
import { useHabibit } from '@/store/HabibitProvider';
import { openTasks, sortedTasks } from '@/store/selectors';

/**
 * Tasks are one-and-done. Checking one stamps `completedAt`, which is permanent
 * until unchecked — no date key involved, so tomorrow changes nothing here.
 */
export function TaskSection() {
  const { state, dispatch } = useHabibit();

  const tasks = sortedTasks(state);
  const open = openTasks(state).length;

  return (
    <section>
      <SectionHeader
        title="Tasks"
        trailing={
          tasks.length > 0 ? (
            <span className="text-xs font-bold text-ink-soft tabular-nums">
              {open} left
            </span>
          ) : null
        }
      />

      <div className="overflow-hidden rounded-card border border-line bg-white">
        {tasks.length === 0 ? (
          <EmptyState
            title="Nothing on the list"
            hint="One-off things go here. They stay done once you check them."
          />
        ) : (
          <ul className="divide-y divide-line">
            {tasks.map((task) => (
              <ItemRow
                key={task.id}
                title={task.title}
                checked={task.completedAt !== null}
                onToggle={() => dispatch({ type: 'TOGGLE_TASK', id: task.id })}
                onRemove={() => dispatch({ type: 'REMOVE_TASK', id: task.id })}
                removeLabel={`Delete task: ${task.title}`}
                confirmLabel={`Confirm deleting ${task.title}`}
              />
            ))}
          </ul>
        )}

        <Composer
          placeholder="Add a task..."
          addLabel="Add task"
          onAdd={(titles) => titles.forEach((title) => dispatch({ type: 'ADD_TASK', title }))}
        />
      </div>
    </section>
  );
}
