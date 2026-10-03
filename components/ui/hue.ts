import type { HabitColour } from '@/lib/look';

/**
 * A habit's colour as Tailwind classes.
 *
 * Written out one class per colour rather than built as `text-hue-${colour}`,
 * because Tailwind finds the classes to generate by **reading the source as
 * text**. An interpolated name is invisible to it, so the colour would be
 * correct in the markup and missing from the stylesheet — the whole palette
 * silently falling back to nothing in the production build while looking right
 * in dev. One of the few places where repetition is the correct answer.
 *
 * The tokens themselves, and their dark values, are in `app/globals.css`, and
 * every one is measured against the card in `lib/contrast.test.ts`.
 */

/** Text and icons in the habit's colour, on a card. */
export const HUE_TEXT: Record<HabitColour, string> = {
  coral: 'text-hue-coral',
  amber: 'text-hue-amber',
  green: 'text-hue-green',
  teal: 'text-hue-teal',
  blue: 'text-hue-blue',
  violet: 'text-hue-violet',
};

/** The ring of an unchecked circle. */
export const HUE_BORDER: Record<HabitColour, string> = {
  coral: 'border-hue-coral',
  amber: 'border-hue-amber',
  green: 'border-hue-green',
  teal: 'border-hue-teal',
  blue: 'border-hue-blue',
  violet: 'border-hue-violet',
};

/** Filled: a checked circle, and a swatch in the chooser. */
export const HUE_BG: Record<HabitColour, string> = {
  coral: 'bg-hue-coral',
  amber: 'bg-hue-amber',
  green: 'bg-hue-green',
  teal: 'bg-hue-teal',
  blue: 'bg-hue-blue',
  violet: 'bg-hue-violet',
};
