'use client';

import { ChevronRight } from 'lucide-react';
import { useId, useState } from 'react';
import type { Habit } from '@/lib/types';

/**
 * "Archived (2)" under the habits card: opens a list where each habit can be
 * brought back. Nothing is shown at all while nothing is archived.
 *
 * Archived habits keep their whole history, so unarchiving one brings its
 * streak back with it. Deleting stays in the `⋯` menu of an active habit, so
 * the only way to lose history is still the deliberate two-tap one.
 */
export function ArchivedHabits({ habits, onUnarchive }: { habits: Habit[]; onUnarchive: (id: string) => void }) {
  const [open, setOpen] = useState(false);
  const listId = useId();

  if (habits.length === 0) return null;

  return (
    <div className="mt-2">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
        aria-controls={listId}
        className="inline-flex min-h-11 touch-manipulation items-center gap-1 rounded-full px-2 text-sm font-bold text-ink-soft transition hover:text-ink focus-visible:outline-2 focus-visible:outline-accent"
      >
        <ChevronRight
          aria-hidden
          className={['h-4 w-4 transition-transform', open ? 'rotate-90' : ''].join(' ')}
          strokeWidth={2.5}
        />
        Archived ({habits.length})
      </button>

      {open && (
        <ul id={listId} className="mt-1 divide-y divide-line overflow-hidden rounded-card border border-line bg-card">
          {habits.map((habit) => (
            <li key={habit.id} className="flex min-h-14 items-center gap-2 pl-4 pr-2">
              <span className="min-w-0 flex-1 break-words text-[15px] leading-snug text-ink-soft">{habit.title}</span>
              <button
                type="button"
                onClick={() => onUnarchive(habit.id)}
                aria-label={`Unarchive ${habit.title}`}
                className="min-h-11 shrink-0 touch-manipulation rounded-full border border-ink-soft bg-card px-3 text-xs font-extrabold text-ink transition active:scale-90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
              >
                Unarchive
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
