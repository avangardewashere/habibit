'use client';

import {
  closestCenter,
  DndContext,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type Announcements,
  type DragEndEvent,
  type UniqueIdentifier,
} from '@dnd-kit/core';
import {
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { ArrowDown, ArrowUp, GripVertical } from 'lucide-react';
import { useEffect, useRef } from 'react';
import type { Habit } from '@/lib/types';

type Move = (id: string, toIndex: number) => void;

/**
 * The habits list in arrange mode: drag a handle, or use ↑ / ↓.
 *
 * Arranging is its own mode (the Arrange button) rather than a handle that is
 * always there, so the rest of the time rows keep their full width and a thumb
 * scrolling the list can't pick one up by accident.
 *
 * Three ways to move a habit, all ending in the same `onMove(id, toIndex)`:
 * - dragging the handle, with a finger or a mouse;
 * - the handle with a keyboard: Space to pick up, arrows to move, Space to drop;
 * - the ↑ / ↓ buttons, one place at a time.
 */
export function ArrangeList({ habits, onMove }: { habits: Habit[]; onMove: Move }) {
  const sensors = useSensors(
    // No press-and-hold delay: the handle has touch-action none, so a drag that
    // starts on it is never mistaken for a scroll, and scrolling anywhere else
    // works as normal.
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const indexOf = (id: UniqueIdentifier) => habits.findIndex((h) => h.id === id);
  const titleOf = (id: UniqueIdentifier) => habits[indexOf(id)]?.title ?? 'Habit';
  const place = (id: UniqueIdentifier) => `position ${indexOf(id) + 1} of ${habits.length}`;

  // What a screen reader hears while dragging, in words rather than the library's ids.
  const announcements: Announcements = {
    onDragStart: ({ active }) => `Picked up ${titleOf(active.id)}, at ${place(active.id)}.`,
    onDragOver: ({ active, over }) =>
      over ? `${titleOf(active.id)} is over ${place(over.id)}.` : `${titleOf(active.id)} is outside the list.`,
    onDragEnd: ({ active, over }) =>
      over ? `${titleOf(active.id)} dropped at ${place(over.id)}.` : `${titleOf(active.id)} put back.`,
    onDragCancel: ({ active }) => `Moving ${titleOf(active.id)} cancelled. It is back where it was.`,
  };

  function onDragEnd({ active, over }: DragEndEvent) {
    if (!over || active.id === over.id) return;
    onMove(String(active.id), indexOf(over.id));
  }

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragEnd={onDragEnd}
      accessibility={{
        announcements,
        screenReaderInstructions: {
          draggable:
            'To move this habit, press space or enter, then the up and down arrow keys. Press space or enter again to drop it, or escape to cancel.',
        },
      }}
    >
      <SortableContext items={habits.map((h) => h.id)} strategy={verticalListSortingStrategy}>
        <ul className="divide-y divide-line">
          {habits.map((habit, index) => (
            <ArrangeRow key={habit.id} habit={habit} index={index} count={habits.length} onMove={onMove} />
          ))}
        </ul>
      </SortableContext>
    </DndContext>
  );
}

function ArrangeRow({ habit, index, count, onMove }: { habit: Habit; index: number; count: number; onMove: Move }) {
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging } =
    useSortable({ id: habit.id });

  /*
   * After ↑ or ↓ the row re-renders in its new place, and the browser can drop
   * focus from a button whose element moved. Put it back, so pressing ↑ four
   * times moves the habit four places.
   */
  const upRef = useRef<HTMLButtonElement>(null);
  const downRef = useRef<HTMLButtonElement>(null);
  const refocus = useRef<'up' | 'down' | null>(null);
  useEffect(() => {
    if (!refocus.current) return;
    (refocus.current === 'up' ? upRef : downRef).current?.focus();
    refocus.current = null;
  }, [index]);

  const first = index === 0;
  const last = index === count - 1;

  function step(direction: 'up' | 'down') {
    // aria-disabled rather than disabled at the ends, so the button keeps focus.
    if (direction === 'up' ? first : last) return;
    refocus.current = direction;
    onMove(habit.id, direction === 'up' ? index - 1 : index + 1);
  }

  const button =
    'grid h-11 w-11 shrink-0 touch-manipulation place-items-center rounded-full text-ink-soft transition focus-visible:outline-2 focus-visible:outline-accent';

  return (
    <li
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={[
        'flex min-h-14 items-center gap-1 bg-card pl-1 pr-2',
        isDragging ? 'relative z-10 rounded-card shadow-lg' : '',
      ].join(' ')}
    >
      <button
        ref={setActivatorNodeRef}
        type="button"
        {...attributes}
        {...listeners}
        aria-label={`Reorder ${habit.title}`}
        className={`${button} cursor-grab touch-none active:cursor-grabbing`}
      >
        <GripVertical className="h-5 w-5" strokeWidth={2.5} />
      </button>

      <span className="min-w-0 flex-1 break-words text-[15px] leading-snug text-ink">{habit.title}</span>

      <button
        ref={upRef}
        type="button"
        onClick={() => step('up')}
        aria-label={`Move ${habit.title} up`}
        aria-disabled={first}
        className={`${button} ${first ? 'opacity-30' : 'hover:bg-badge-bg hover:text-ink active:scale-90'}`}
      >
        <ArrowUp className="h-5 w-5" strokeWidth={2.5} />
      </button>
      <button
        ref={downRef}
        type="button"
        onClick={() => step('down')}
        aria-label={`Move ${habit.title} down`}
        aria-disabled={last}
        className={`${button} ${last ? 'opacity-30' : 'hover:bg-badge-bg hover:text-ink active:scale-90'}`}
      >
        <ArrowDown className="h-5 w-5" strokeWidth={2.5} />
      </button>
    </li>
  );
}
