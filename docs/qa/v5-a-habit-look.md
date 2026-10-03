# Habibit: v5 Block A, habits get a face

**Block:** A of 3 (v5) · **Date:** 2026-10-04 · **Status:** ✅ all four suites green on CI (run 37144080754), first try: 622 unit / 9 DST / 107 database / 262 browser, matching the local run exactly. Signed off and merged on 2026-10-04

> **Every habit now has a colour and an icon, and nobody had to choose either.** "Drink water"
> arrives as a droplet, "Run 5k" as footprints, "Read before bed" as a book, each in its own
> colour. Habits that already exist get one the moment this build loads, with nothing migrated
> and nothing rewritten. Both can be changed, or the icon switched off, from the habit's own
> sheet.

**Legend:** ✅ pass · 🔴 **proven**: shown to fail when the guard was deliberately broken

---

## The decisions in this block

| Decision | Choice | Whose |
|---|---|---|
| How far to go | **Colour and icon**, not one or the other | yours, 2026-10-01 |
| Where it's chosen | The `⋯` menu's **When** pill is now **Edit**, and its sheet is the habit's own editor: **Look**, **How often**, **Remind me** | mine, explained below |
| A habit nobody has chosen for | Colour **derived from its id**; icon **guessed from its title**. Nothing is stored | mine, changed during the build |
| Turning the icon off | A real choice, **"No icon"**, stored as `none` | mine |

**Why not a fifth pill.** Four pills already only just fit beside a title on a 375px phone (v3
measured it). The sheet already held two unrelated things, how often and reminders, so it was the
habit's settings page in all but name. It now opens with the habit's own name and a Look section.
**Rename** stays as its own pill because it's the common edit and it happens in place.

---

## What this block found, before any of it shipped

### The first design would have left every existing habit grey for ever

The plan said a new habit would be *given* a stored colour when added. That covers new habits
only. Every habit anyone already has, which is all of them, would have stayed grey until edited
by hand. Backfilling them on load would mean a write on every open, an upload of every row, and
two devices racing to pick different colours for the same habit.

So nothing is stored until somebody chooses. An un-chosen colour is **derived from the habit's
id** (a small hash, the same answer on every device for ever), and an un-chosen icon is **guessed
from its title**. Existing habits got a face with no migration at all. V5A-71 proves it in a real
browser, from storage exactly as a v4 build left it.

### An unticked habit with no icon looked ticked

Found by **V5A-74** in a real browser, not by any unit test. A task's empty circle holds a tick in
*transparent* ink, ready to fade in. A habit's empty circle is inked in the habit's colour, so the
same tick became **visible**: choose "No icon" and the habit looked done when it wasn't. The empty
coloured circle now draws nothing inside, and **V5A-80** pins that without needing a browser.

### Tailwind can silently drop a colour, and it's only half visible

Tailwind decides which classes to generate by reading the source **as text**. A class built at run
time (`text-hue-${colour}`) is correct in the markup and missing from the stylesheet. Every unit
test passes, the colour falls back to nothing, and only the production build shows it. The six
colours are therefore written out one by one in `components/ui/hue.ts`, and **V5A-73** checks
each colour's *computed* value in a real browser.

A mutation check found a subtlety in that test. With only the **ring's** class missing, nothing
changes on screen: a border with no colour falls back to `currentColor`, which is the icon's
colour, which is the same hue. That mutant is equivalent, and no test could or should catch it.
With the **icon's** class missing it shows, so V5A-73 now checks both, and the realistic version
of the trap is 🔴 proven.

### Two mistakes of my own, in the tests

- **V5A-73 read a colour mid-fade.** The circle fades between colours over 150ms, and reading once
  straight after a click caught it halfway (`rgb(164, 64, 112)`, a blend of two hues). It now
  waits for the value to settle, as does V5A-75, which had only been passing by luck.
- **One mutation hit the wrong rule.** Dark mode is declared twice: once for "the device prefers
  dark" and once for "you chose dark". My first attempt to delete a hue from the second matched
  the first, because its indentation contains the other's. That mutant survived, which looked like
  a gap in V5A-75 until the built CSS showed which rule had actually lost the line. Re-run against
  the right targets, both are 🔴 proven: the device rule by the unit test that keeps the two
  identical, the chosen rule by V5A-75.

---

## How it works

| Piece | Where | Job |
|---|---|---|
| What a habit looks like | `lib/look.ts` | the palette, the icons, parsing, the title guess, the id-derived colour |
| Two new fields | `lib/types.ts` · `lib/storage.ts` · `lib/sync/rows.ts` | `icon`, `colour`: text kept verbatim, `null` = nothing chosen |
| The database | `…_habit_look.sql` | two nullable columns, checked for **shape** only |
| Choosing | `store/reducer.ts` — `SET_LOOK` | refuses nonsense, no-op when unchanged, queued for sync |
| The colours | `app/globals.css` · `components/ui/hue.ts` | six hues with light **and** dark values, each written out literally |
| Drawing it | `components/ui/CheckCircle.tsx` | ring + icon when not done, filled + tick when done |
| The chooser | `components/habit/HabitLook.tsx` | six swatches, sixteen icons, "No icon" |

**Colour is never the signal.** Done is a filled circle with a tick and not done is a ring, in
every colour, so the state survives grayscale and colour blindness. The colour says *which* habit,
not *whether*. Each swatch carries its name and a tick when chosen.

**v4's rule, again: what this build can't draw, it keeps.** An icon added in a later version is
stored, read and written back here untouched. It draws as no icon on this build and never gets
replaced by a guess, because that would show something the owner had explicitly swapped out.

---

## Results

### Rules — `lib/look.test.ts`, `store/look.test.ts`, `lib/storage.test.ts`

| # | Check | |
|---|---|---|
| V5A-02/03 | every name this build draws can be stored, **and so can one it has never heard of** | ✅ |
| V5A-04/05 | nonsense can't; the length limit is exactly the database's | ✅ |
| V5A-09/10 | a habit nobody chose for still has a colour, **the same one on every device** | ✅ |
| V5A-11 | different habits get different colours (all six appear across 60 ids) | ✅ 🔴 |
| V5A-13 | a colour from a newer build falls back rather than showing nothing | ✅ |
| V5A-14 | "Drink water" → droplet, "Meditation" → brain, and six more | ✅ |
| V5A-15 | **"Water the plants" is a plant**, not a drink | ✅ 🔴 |
| V5A-17 | a title it can't read gets no icon rather than a wrong one | ✅ |
| V5A-21 | "No icon" is a choice and beats the guess | ✅ |
| V5A-22 | **an icon from a newer build draws as nothing, not as a guess** | ✅ 🔴 |
| V5A-30/31 | a new habit stores no look, and is still drawn with one | ✅ |
| V5A-33 | choosing what it already is changes nothing, not even `updatedAt` | ✅ 🔴 |
| V5A-36 | a value not shaped like a name is refused | ✅ 🔴 |
| V5A-39 | the change is queued for the account | ✅ 🔴 |
| V5A-40 | data saved before v5 loads with nothing chosen, no storage version bump | ✅ |
| V5A-41 | **a look this build can't draw survives loading** | ✅ 🔴 |

### The chooser and the circle — `HabitLook.test.tsx`, `CheckCircle.test.tsx`

| # | Check | |
|---|---|---|
| V5A-50/51 | the colour and icon **drawn** are shown as chosen, though nothing is stored | ✅ |
| V5A-52/53 | picking a colour keeps the icon, and picking an icon keeps the colour | ✅ 🔴 |
| V5A-55 | "No icon" turns the guess off | ✅ |
| V5A-57 | every control has a name a screen reader can read | ✅ |
| V5A-80 | **an unticked habit with no icon draws nothing inside, not a tick** | ✅ 🔴 |
| V5A-83 | a task's circle is exactly as before | ✅ |

### Database — `supabase/tests/look.test.ts`

| # | Check | |
|---|---|---|
| V5A-60 | a look is stored and reaches another device | ✅ 🔴 |
| V5A-61 | **an upload from a v4 phone leaves the stored look alone** (v4 Block B's proof, repeated) | ✅ |
| V5A-63 | an icon from a newer build survives a rename made here, round trip | ✅ 🔴 |
| V5A-65 | the database refuses a name not shaped like one, in both columns | ✅ |
| V5A-66 | its length limit is exactly the app's | ✅ |
| V5A-67 | two devices agree, latest change wins | ✅ |

### Browser — `e2e/look.spec.ts`, Android and desktop

| # | Check | |
|---|---|---|
| V5A-70 | a new habit arrives with a colour and an icon, chosen by nobody and stored nowhere | ✅ 🔴 |
| V5A-71 | **a habit saved by v4 gets a face too, without being rewritten** | ✅ |
| V5A-72 | a chosen look is stored and survives a reload | ✅ |
| V5A-73 | **every colour actually reaches the stylesheet**, ring and icon | ✅ 🔴 |
| V5A-74 | "No icon" leaves a plain coloured ring | ✅ |
| V5A-75 | the colours change with the theme | ✅ 🔴 |
| V5A-76 | the pill says Edit and opens the habit's own sheet | ✅ |

### Mutation checks: 15 killed, 1 equivalent

| # | Broke | Caught by |
|---|---|---|
| M1 | unknown stored icon falls back to the title guess | V5A-22 |
| M2 | "water" matched before "plant" | V5A-15 |
| M3 | the derived colour is a constant | V5A-11 |
| M4 | `SET_LOOK`'s no-op guard removed | V5A-33 |
| M5 | `SET_LOOK` stores anything | V5A-36 |
| M6 | `SET_LOOK` not registered with sync | **the build**: the exhaustive switch refuses to compile |
| M7 | loading clears a look this build can't draw | V5A-41 |
| M8 | picking a colour drops the icon | V5A-52 |
| M9 | reading from the account clears an unknown icon | V5A-63 (database) |
| M10 | uploading omits the icon | V5A-60 (database) |
| M11 | a colour class built at run time: **the Tailwind trap** | V5A-73 (browser) |
| M12 | the circle ignores the habit's colour | V5A-70 (browser) |
| M13a | the device-prefers-dark rule loses a hue | `lib/contrast.test.ts` |
| M13b | the you-chose-dark rule loses a hue | V5A-75 (browser) |
| M14 | the empty coloured circle falls back to the tick | V5A-80 |
| — | only the **ring's** colour class built at run time | *equivalent*: the ring falls back to `currentColor`, the same hue, so nothing visible changes |

Every mutated file was checked byte-identical afterwards.

### Older tests whose meaning changed (not broken)

- **V4B-42** asserted the sheet read *"Drink water — Mon, Wed and Fri"*. The name is now the
  sheet's heading and the schedule the line beneath it, so it asserts each separately.
- **e2e V4B-50/51** and **the three habit-reminder specs** opened the sheet by the old pill's name,
  *"When … is due"*, which is now *"Edit …: its colour and icon, when it is due…"*.
- **Every test helper that builds a habit** gained `icon: null, colour: null`. TypeScript required it,
  and that's the point: no test can build a habit that silently lacks the new fields.

---

## One intermittent failure, not from this block

Across six runs of the database suite with nothing else competing for the local database, five
were 107/107 and **one failed two tests at once: V3E-40 and V4F-41**. Both are v3/v4 reminder-timing
tests, and this block changes no reminder code, migration or function they use. Each passes on
its own, and the full suite passed the three times it was run straight afterwards.

The cause is **not established**. V3E-40 only checks its own two users, and the one function that
could mark them as already sent is called from the same file, in order, so the obvious
cross-file race does not fit. It is flagged as its own piece of work rather than patched here on
a guess, because a "fix" to a test whose failure isn't understood is how a real bug gets hidden.

(Two further runs failed six files at setup. Those were my own doing: the browser suite was still
running in the background against the same local Supabase.)

## Contrast

Each hue carries an icon **and** a streak count, and a count is text, so each is held to **4.5:1
against the card in both themes** (the text bar, not the 3:1 icon bar). The one first draft that
failed was coral at 4.48:1, so it was darkened to `#D6384A` (4.64:1) by measuring. All 24 new pairs (six hues, two themes, text and tick)
are in `lib/contrast.test.ts`, which reads the hues straight from the CSS, so a seventh colour added
without measuring fails the suite.

## Optional check, yours if you want it

Only a person can judge whether it **looks good**. On your Android phone, after the deploy:

1. Add four habits: *Drink water*, *Run*, *Read*, *Meditate*.
2. Do they look like four different things at a glance?
3. Tick one. Is it obviously done, in its colour?
4. Edit → Look: pick a colour and an icon you like better.

Not marked passed on your behalf.

## Still owed from v4, unchanged by this block

The production build for v4 still fails on Vercel; the live site is still the 21 September bundle,
so neither v4 nor this block is visible there yet. The build log names the missing setting.
