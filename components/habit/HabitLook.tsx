'use client';

import { Check, Ban } from 'lucide-react';
import { HUE_BG, HUE_BORDER, HUE_TEXT } from '@/components/ui/hue';
import {
  HABIT_COLOURS,
  HABIT_ICONS,
  NO_ICON,
  describeColour,
  describeIcon,
  resolveColour,
  resolveIcon,
  type HabitColour,
  type StoredLook,
} from '@/lib/look';
import type { Habit } from '@/lib/types';
import { HabitIcon } from './HabitIcon';

/**
 * Choosing what a habit looks like (v5 Block A).
 *
 * The first section of the habit's own sheet. Like the two below it there is no
 * Save: a tap is written immediately, so the sheet can be closed or the app
 * killed without a half-made decision hanging around.
 *
 * **What is shown as chosen is what is *drawn*, not what is stored.** A habit
 * with nothing stored is still drawn in a colour derived from its id and an
 * icon guessed from its title, and showing that as "nothing selected" would be
 * a lie about what is on screen. Tapping the one already highlighted therefore
 * does something real — it writes down the thing that until then was only
 * being inferred.
 */
export function HabitLook({
  habit,
  onChoose,
}: {
  habit: Habit;
  onChoose: (icon: StoredLook, colour: StoredLook) => void;
}) {
  const colour = resolveColour(habit.colour, habit.id);
  const icon = resolveIcon(habit.icon, habit.title);

  return (
    <section className="mt-6">
      <h3 className="text-xs font-bold uppercase tracking-wide text-ink-soft">Look</h3>

      <div className="mt-2 rounded-card border border-line bg-card p-4">
        <div className="flex flex-wrap gap-2" role="group" aria-label="Colour">
          {HABIT_COLOURS.map((option) => (
            <Swatch
              key={option}
              colour={option}
              chosen={option === colour}
              onSelect={() => onChoose(habit.icon, option)}
            />
          ))}
        </div>

        <div className="mt-4 grid grid-cols-6 gap-1" role="group" aria-label="Icon">
          {HABIT_ICONS.map((option) => (
            <IconButton
              key={option}
              label={describeIcon(option)}
              chosen={option === icon}
              colour={colour}
              onSelect={() => onChoose(option, habit.colour)}
            >
              <HabitIcon name={option} className="h-5 w-5" />
            </IconButton>
          ))}
          <IconButton
            label="No icon"
            /*
             * Only when nothing is drawn. A habit whose title matched nothing
             * is already iconless without anyone asking, and highlighting this
             * then would suggest a choice had been made.
             */
            chosen={icon === null}
            colour={colour}
            onSelect={() => onChoose(NO_ICON, habit.colour)}
          >
            <Ban className="h-5 w-5" strokeWidth={2.5} aria-hidden />
          </IconButton>
        </div>
      </div>
    </section>
  );
}

/** One colour. A tick rather than only a ring, so the choice is not colour-only. */
function Swatch({
  colour,
  chosen,
  onSelect,
}: {
  colour: HabitColour;
  chosen: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      aria-pressed={chosen}
      aria-label={describeColour(colour)}
      className={[
        'grid h-11 w-11 touch-manipulation place-items-center rounded-full border-2 transition active:scale-90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent',
        HUE_BG[colour],
        chosen ? 'border-ink' : 'border-transparent',
      ].join(' ')}
    >
      <Check className={`h-5 w-5 text-on-hue ${chosen ? '' : 'opacity-0'}`} strokeWidth={3} aria-hidden />
    </button>
  );
}

/** One icon, drawn in the habit's current colour so the pair can be judged together. */
function IconButton({
  label,
  chosen,
  colour,
  onSelect,
  children,
}: {
  label: string;
  chosen: boolean;
  colour: HabitColour;
  onSelect: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      aria-pressed={chosen}
      aria-label={label}
      className={[
        'grid h-11 w-full touch-manipulation place-items-center rounded-xl border transition active:scale-90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent',
        chosen ? `${HUE_BORDER[colour]} border-2 ${HUE_TEXT[colour]}` : 'border-line text-ink-soft',
      ].join(' ')}
    >
      {children}
    </button>
  );
}
