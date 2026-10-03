import { describe, expect, it } from 'vitest';
import {
  HABIT_COLOURS,
  HABIT_ICONS,
  LONGEST_LOOK,
  NO_ICON,
  colourFor,
  describeColour,
  describeIcon,
  guessIcon,
  isStoredLook,
  parseColour,
  parseIcon,
  resolveColour,
  resolveIcon,
} from './look';

/*
 * v5 Block A: what a habit looks like.
 *
 * Two things are being guarded here, and only one of them is about colour.
 *
 * The first is that **nothing has to be stored for a habit to have a face**.
 * That is what makes the feature arrive for habits that already exist, and it
 * is why `resolve*` and not `parse*` is what the UI calls.
 *
 * The second is v4 Block B's rule, repeated: a value this build cannot draw is
 * **kept**, not corrected, because it may have come from a newer build and
 * correcting it here would upload the loss to every device.
 */

describe('V5A: what can be stored', () => {
  it('V5A-01 · nothing is a valid look', () => {
    expect(isStoredLook(null)).toBe(true);
  });

  it('V5A-02 · ⭐ every name this build can draw can be stored', () => {
    for (const colour of HABIT_COLOURS) expect(isStoredLook(colour), colour).toBe(true);
    for (const icon of HABIT_ICONS) expect(isStoredLook(icon), icon).toBe(true);
    expect(isStoredLook(NO_ICON)).toBe(true);
  });

  it('V5A-03 · ⭐ a name this build has never heard of can still be stored', () => {
    // The whole point. A v6 icon has to survive a round trip through v5.
    for (const future of ['saxophone', 'ice-bath', 'hue7', 'a']) {
      expect(isStoredLook(future), future).toBe(true);
    }
  });

  it('V5A-04 · but nonsense cannot', () => {
    for (const bad of ['Teal', 'sea green', '', '-teal', '7teal', 'teal!', 'x'.repeat(LONGEST_LOOK + 1), 7, {}, undefined]) {
      expect(isStoredLook(bad), JSON.stringify(bad)).toBe(false);
    }
  });

  it('V5A-05 · the longest name allowed is exactly the database’s limit', () => {
    // supabase/migrations/…_habit_look.sql checks char_length(...) <= 24.
    expect(isStoredLook('a'.repeat(LONGEST_LOOK))).toBe(true);
    expect(isStoredLook('a'.repeat(LONGEST_LOOK + 1))).toBe(false);
  });
});

describe('V5A: reading a stored look', () => {
  it('V5A-06 · a name this build knows reads back as itself', () => {
    expect(parseColour('teal')).toBe('teal');
    expect(parseIcon('book-open')).toBe('book-open');
  });

  it('V5A-07 · ⭐ anything else reads as nothing, rather than throwing or guessing', () => {
    for (const unknown of ['saxophone', 'Teal', '', null, undefined]) {
      expect(parseColour(unknown), String(unknown)).toBeNull();
      expect(parseIcon(unknown), String(unknown)).toBeNull();
    }
  });

  it('V5A-08 · an icon name is never mistaken for a colour, or the other way round', () => {
    expect(parseColour('droplet')).toBeNull();
    expect(parseIcon('teal')).toBeNull();
  });
});

describe('V5A: a habit nobody has chosen for', () => {
  it('V5A-09 · ⭐ still has a colour', () => {
    expect(HABIT_COLOURS).toContain(resolveColour(null, 'any-id'));
  });

  it('V5A-10 · ⭐ gets the same colour on every device, for ever', () => {
    // Derived from the id, which never changes — this is what lets the colour
    // be unstored. If it ever became random or order-dependent, two devices
    // would disagree and the same habit would change colour on reload.
    const id = '6b1f0c3a-2d4e-4f8a-9b7c-0e1d2f3a4b5c';
    expect(colourFor(id)).toBe(colourFor(id));
    expect(resolveColour(null, id)).toBe(colourFor(id));
  });

  it('V5A-11 · ⭐ different habits mostly get different colours', () => {
    // Not a promise of no collisions — six colours and a hash cannot give that
    // — but a spread. A hash that returned one colour would pass every other
    // test here and make the whole feature pointless.
    const ids = Array.from({ length: 60 }, (_, i) => `11111111-2222-3333-4444-${String(i).padStart(12, '0')}`);
    const seen = new Set(ids.map(colourFor));
    expect(seen.size).toBe(HABIT_COLOURS.length);
  });

  it('V5A-12 · a colour chosen by hand beats the derived one', () => {
    const id = 'some-id';
    const other = HABIT_COLOURS.find((c) => c !== colourFor(id))!;
    expect(resolveColour(other, id)).toBe(other);
  });

  it('V5A-13 · ⭐ a colour from a newer build falls back rather than showing nothing', () => {
    // It stays stored (V5A-03); it simply cannot be drawn here.
    expect(resolveColour('ultramarine', 'some-id')).toBe(colourFor('some-id'));
  });
});

describe('V5A: guessing an icon from the title', () => {
  it.each([
    ['Drink water', 'droplet'],
    ['Run 5k', 'footprints'],
    ['Go to the gym', 'dumbbell'],
    ['Read before bed', 'book-open'],
    ['Meditation', 'brain'],
    ['Take vitamins', 'pill'],
    ['Morning pages', 'sun'],
    ['Practice guitar', 'music'],
  ])('V5A-14 · "%s" suggests %s', (title, icon) => {
    expect(guessIcon(title)).toBe(icon);
  });

  it('V5A-15 · ⭐ "Water the plants" is a plant, not a drink', () => {
    // The order of the hint list is load-bearing, and this is the case that
    // proves it: the title contains "water", and a watering can is not what
    // the habit is about. Reordering the list breaks this and nothing else.
    expect(guessIcon('Water the plants')).toBe('leaf');
  });

  it('V5A-16 · case and surrounding words do not matter', () => {
    expect(guessIcon('RUNNING in the morning')).toBe('footprints');
  });

  it('V5A-17 · ⭐ a title it cannot read gets no icon, rather than a wrong one', () => {
    // A wrong icon is worse than none: it is on screen every day and says
    // something untrue about the habit.
    expect(guessIcon('Zzzzz qqq')).toBeNull();
    expect(guessIcon('')).toBeNull();
  });

  it('V5A-18 · every icon it can suggest is one this build can draw', () => {
    for (const title of ['water', 'run', 'gym', 'read', 'sleep', 'wake', 'plant', 'eat', 'write', 'music', 'bike', 'pill', 'meditate', 'save', 'gratitude', 'coffee']) {
      const icon = guessIcon(title);
      expect(icon, title).not.toBeNull();
      expect(HABIT_ICONS, title).toContain(icon);
    }
  });
});

describe('V5A: which icon is drawn', () => {
  it('V5A-19 · the one chosen, over the guess', () => {
    expect(resolveIcon('moon', 'Drink water')).toBe('moon');
  });

  it('V5A-20 · the guess, when nothing is chosen', () => {
    expect(resolveIcon(null, 'Drink water')).toBe('droplet');
  });

  it('V5A-21 · ⭐ "no icon" is a choice, and it beats the guess', () => {
    // Without a word for this, a habit called "Read the news" could never stop
    // being a book: null means "nothing chosen", which falls back to the guess.
    expect(resolveIcon(NO_ICON, 'Read the news')).toBeNull();
  });

  it('V5A-22 · an icon from a newer build draws as nothing here, not as a guess', () => {
    // It is kept (V5A-03). Falling back to the guess would be worse than
    // nothing: it would show an icon the owner explicitly replaced.
    expect(resolveIcon('saxophone', 'Practice guitar')).toBeNull();
  });
});

describe('V5A: names people read', () => {
  it('V5A-23 · every colour and icon has one, for the chooser’s accessible names', () => {
    for (const colour of HABIT_COLOURS) expect(describeColour(colour)).toMatch(/^[A-Z]/);
    for (const icon of HABIT_ICONS) expect(describeIcon(icon)).toMatch(/^[A-Z]/);
  });
});
