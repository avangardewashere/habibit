/**
 * What a habit looks like: a colour and an icon.
 *
 * v5 Block A. Habibit spent four versions getting the behaviour right and shows
 * every habit as the same grey line of text. A colour and an icon cost nothing
 * to carry and are the difference between a list and an app you can scan.
 *
 * **Nobody has to choose either, and nothing is stored until they do.** A habit
 * with no colour of its own is drawn in one derived from its id, and one with
 * no icon of its own is drawn with one guessed from its title. So every habit
 * that already exists gets a face the moment this build loads, with no
 * migration, no write on read and no upload. See `colourFor` for why that
 * matters more than it sounds.
 *
 * The storage rules here are v4 Block B's rules for `schedule`, for the same
 * reasons — see `lib/schedule.ts` for the long version:
 *
 * - a value is **kept exactly as stored**, so an icon from a build this one has
 *   never met passes through untouched rather than being erased on the next
 *   edit made here;
 * - `null` is the only way to say "nothing", so a habit from before v5 and a
 *   habit set back to plain are the same row and a round trip compares equal.
 *
 * Pure: no React, no clock, no lucide import. The name-to-component mapping
 * lives in `components/habit/HabitIcon.tsx`, which keeps this file testable in
 * a plain node environment and keeps the icon set out of every bundle that only
 * needs to validate a string.
 */

/** The colours this build can draw. Tokens of the same names are in `app/globals.css`. */
export const HABIT_COLOURS = ['coral', 'amber', 'green', 'teal', 'blue', 'violet'] as const;
export type HabitColour = (typeof HABIT_COLOURS)[number];

/** The icons this build can draw, as lucide names in kebab-case. */
export const HABIT_ICONS = [
  'droplet',
  'footprints',
  'dumbbell',
  'book-open',
  'moon',
  'sun',
  'leaf',
  'apple',
  'coffee',
  'pencil',
  'music',
  'bike',
  'pill',
  'brain',
  'piggy-bank',
  'heart',
] as const;
export type HabitIcon = (typeof HABIT_ICONS)[number];

/**
 * A colour or an icon as it is stored on the habit: text, or `null` for none.
 *
 * Both fields share one type and one validator because they share one rule.
 */
export type StoredLook = string | null;

/** Matches the database's own limit (supabase/migrations/…_habit_look.sql). */
export const LONGEST_LOOK = 24;

/**
 * Is this worth keeping in `icon` or `colour`?
 *
 * Deliberately **not** a membership test against the lists above. A value this
 * build doesn't know may come from a newer one and has to survive being read
 * and written back here; what it *means* is `parseColour`/`parseIcon`'s job,
 * and anything unrecognised there simply draws as nothing. This only stops
 * something that could never be either from reaching the database.
 */
export function isStoredLook(value: unknown): value is StoredLook {
  if (value === null) return true;
  return typeof value === 'string' && value.length <= LONGEST_LOOK && /^[a-z][a-z0-9-]*$/.test(value);
}

/** Text → a colour this build can draw, or `null` for the app's own accent. */
export function parseColour(stored: StoredLook | undefined): HabitColour | null {
  return typeof stored === 'string' && (HABIT_COLOURS as readonly string[]).includes(stored)
    ? (stored as HabitColour)
    : null;
}

/** Text → an icon this build can draw, or `null` for no icon at all. */
export function parseIcon(stored: StoredLook | undefined): HabitIcon | null {
  return typeof stored === 'string' && (HABIT_ICONS as readonly string[]).includes(stored)
    ? (stored as HabitIcon)
    : null;
}

/**
 * Titles that suggest an icon, **most specific first**.
 *
 * Order is load-bearing: "Water the plants" contains "water", and a watering
 * can is not what that habit is about, so `plant` is matched before `water`.
 * A guess is a courtesy, never a requirement — anything unrecognised gets no
 * icon and shows its colour alone, which is already enough to tell rows apart.
 */
const ICON_HINTS: ReadonlyArray<readonly [readonly string[], HabitIcon]> = [
  [['plant', 'garden', 'flower', 'seed'], 'leaf'],
  [['coffee', 'tea', 'espresso', 'brew'], 'coffee'],
  [['water', 'drink', 'hydrat', 'glass'], 'droplet'],
  [['walk', 'step', 'run', 'jog', 'hike'], 'footprints'],
  [['gym', 'workout', 'exercise', 'lift', 'squat', 'push', 'yoga', 'stretch'], 'dumbbell'],
  [['read', 'book', 'study', 'learn', 'revise'], 'book-open'],
  [['sleep', 'bed', 'night', 'rest'], 'moon'],
  [['wake', 'morning', 'sunrise', 'early'], 'sun'],
  [['eat', 'meal', 'fruit', 'veg', 'breakfast', 'lunch', 'dinner', 'diet'], 'apple'],
  [['write', 'journal', 'diary', 'blog', 'note'], 'pencil'],
  [['music', 'guitar', 'piano', 'sing', 'practice'], 'music'],
  [['bike', 'cycle', 'cycling', 'ride'], 'bike'],
  [['pill', 'vitamin', 'medic', 'supplement', 'tablet'], 'pill'],
  [['meditat', 'mindful', 'breath', 'calm', 'focus'], 'brain'],
  [['save', 'money', 'budget', 'spend', 'invest'], 'piggy-bank'],
  [['gratitude', 'thank', 'family', 'call', 'love'], 'heart'],
];

/**
 * An icon suggested by a habit's title, or `null` when nothing fits.
 *
 * Substring matching rather than whole words, so "Running" and "Meditation"
 * both land. Case and surrounding punctuation are ignored.
 */
export function guessIcon(title: string): HabitIcon | null {
  const text = title.toLowerCase();
  for (const [hints, icon] of ICON_HINTS) {
    if (hints.some((hint) => text.includes(hint))) return icon;
  }
  return null;
}

/**
 * A colour for a habit that has never been given one, from its id.
 *
 * **Nothing is written.** The first design here gave every new habit a stored
 * colour in `ADD_HABIT`, and it was wrong twice over: every habit that already
 * existed — which is all of them, for anyone already using Habibit — would have
 * stayed grey for ever, and backfilling them on read would have meant a write
 * on load, an upload of every row, and two devices racing to pick.
 *
 * Deriving it instead means an un-chosen colour costs no storage, no sync and
 * no migration, and every device shows the same one because an id never
 * changes. Choosing a colour by hand still writes, and still wins.
 *
 * FNV-1a, which is small, has no dependencies and spreads short similar strings
 * (UUIDs differing in one character) across the palette. The quality bar is
 * "two habits usually look different", not cryptography.
 */
export function colourFor(id: string): HabitColour {
  let hash = 0x811c9dc5;
  for (let i = 0; i < id.length; i += 1) {
    hash ^= id.charCodeAt(i);
    // ×16777619 in 32-bit arithmetic, written as shifts so it cannot overflow
    // into a float and lose the low bits.
    hash = (hash + (hash << 1) + (hash << 4) + (hash << 7) + (hash << 8) + (hash << 24)) >>> 0;
  }
  return HABIT_COLOURS[hash % HABIT_COLOURS.length];
}

/**
 * The colour to draw a habit in: the one chosen for it, or one derived from its
 * id. Always a colour — a habit is never grey.
 */
export function resolveColour(stored: StoredLook | undefined, id: string): HabitColour {
  return parseColour(stored) ?? colourFor(id);
}

/**
 * Stored when somebody asks for **no icon at all**.
 *
 * `null` cannot say this: it means "nothing chosen", and nothing chosen falls
 * back to the guess. Without a word for "I looked at your guess and I don't
 * want it", a habit called "Read the news" could never stop being a book. It is
 * a name like any other as far as the database is concerned, and a build that
 * doesn't know it simply draws no icon either, which is the right answer.
 */
export const NO_ICON = 'none';

/**
 * The icon to draw for a habit: the one chosen for it, or one guessed from its
 * title, or none.
 *
 * Unlike the colour this can genuinely be nothing, because a wrong icon is
 * worse than no icon and the guess is only a keyword match.
 *
 * **The guess applies only when nothing is stored.** A stored name this build
 * cannot draw — `none`, or an icon added in a later version — draws nothing,
 * rather than falling back to the title. Falling back would put an icon on
 * screen that the owner had explicitly replaced, which is the one outcome
 * worse than a blank circle. The value itself is still kept (`isStoredLook`),
 * so the newer build keeps showing what it chose.
 */
export function resolveIcon(stored: StoredLook | undefined, title: string): HabitIcon | null {
  if (stored === null || stored === undefined) return guessIcon(title);
  return parseIcon(stored);
}

/** Plain English for an accessible name, e.g. "Teal". */
export function describeColour(colour: HabitColour): string {
  return colour.charAt(0).toUpperCase() + colour.slice(1);
}

/** Plain English for an accessible name, e.g. "Book". */
const ICON_NAMES: Record<HabitIcon, string> = {
  droplet: 'Water',
  footprints: 'Footprints',
  dumbbell: 'Dumbbell',
  'book-open': 'Book',
  moon: 'Moon',
  sun: 'Sun',
  leaf: 'Leaf',
  apple: 'Apple',
  coffee: 'Coffee',
  pencil: 'Pencil',
  music: 'Music',
  bike: 'Bicycle',
  pill: 'Pill',
  brain: 'Brain',
  'piggy-bank': 'Piggy bank',
  heart: 'Heart',
};

export function describeIcon(icon: HabitIcon): string {
  return ICON_NAMES[icon];
}
