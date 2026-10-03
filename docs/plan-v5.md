# Habibit v5: Looks like a finished app

**Goal:** make Habibit *look* like the app it already is.

This version is different from the four before it, and the brief came from you on 2026-10-01:

> this is a sample project only for my portfolio we just have to make sure it looks good and working

So v5 is not product work. Nobody is being acquired, retained or converted. The reader is a
stranger who clicks a link, looks for forty seconds on a phone, and decides what they think of
the person who built it. Everything below is chosen against that one test.

## What the brief rules out

Named here so they stop coming up: data export, actionable notifications, quantified habits
(8 glasses, 30 minutes), sharing, a marketing landing page. All reasonable product ideas, none
of them visible in forty seconds.

## What is actually wrong

Three things, found by reading the tree rather than guessing.

1. **Habibit is one screen.** `app/page.tsx`, plus `/auth/confirm` and `/privacy`. Review,
   schedules, reminders, theme and account are all sheets that slide over that one screen. An
   app with nowhere to go reads as a prototype however good the screen is.
2. **Every habit looks identical.** `lib/types.ts` has `title` and nothing else to look at —
   the `emoji` field sketched in v0 was never built. The list is grey text in a column.
3. **It opens empty.** A visitor sees "Add a habit…". Streaks, the day strip, the year grid and
   schedules — four versions of work — are invisible until somebody has used the app for a week.

## The three blocks

| Block | Delivers |
|---|---|
| **A — Habits get a face** | A colour and an icon per habit, given automatically, changeable by hand |
| **B — Somewhere to go** | Bottom navigation: Today · Progress · Settings |
| **C — Never opens empty** | A real welcome, and one tap that fills the app with a believable few months |

**Why that order.** C is the block that decides whether any of this is *seen*, so it is the most
valuable — but A and B both change what a filled screen looks like, and the screenshots are worth
taking once, at the end. A is first because it is self-contained and B's Progress tab wants it.

**The risk to watch, in Block B.** A tab bar makes an app feel complete only if the tabs are full.
If Progress is one chart and Settings is three switches, navigation does not hide the thinness, it
advertises it twice. Most of what Progress needs already exists in `store/selectors.ts` from v4
Blocks C and D (`habitReview`, `bestEver`, `sinceYouStarted`, `YEAR_WEEKS`), which is why the block
is worth attempting — but that is the thing to confirm before building the bar, not after.

## Decisions locked

| Decision | Choice |
|---|---|
| Block A scope | **Colour and icon**, not one or the other (asked 2026-10-01) |
| Where the look is chosen | A **Look** section in the habit's own sheet, which Block A turns into a per-habit editor |
| Default look | **Given automatically** on add — a colour from the palette, an icon guessed from the title |
| Not in v5 | Export, notification actions, quantities, sharing, a landing page |

Sign-off works as in v2, v3 and v4: each block ends with a report in `docs/qa/`, every row is an
automated test, each new guard is shown to go red when it is broken, and anything only a real
phone can prove goes in an *optional checks* list and is never marked passed on your behalf.

## Still owed from v4

v5 does not clear this, and v4 is not visible to anyone until it is done.

- [ ] **The production build succeeds.** The Vercel build for `6286679` failed on 2026-10-01; the
  live site is still the 21 September bundle. The code is not the cause — a local build with
  `VERCEL_ENV=production` compiles clean — so it is the two `NEXT_PUBLIC_SUPABASE_*` settings not
  reaching the Production environment. The build log names which one.
- [ ] `npm run smoke` goes 16 for 16 (V3G-56 is the one red check)
- [ ] Sign-in email arrives (SMTP)
- [ ] Site URL and redirect URLs set in Supabase
- [ ] VAPID keys set, `send-reminders` deployed, cron scheduled
- [ ] A reminder has arrived on a real locked Android phone (v4 Block F's optional checks)

---

# Block A — Habits get a face

A habit gets a **colour** and an **icon**. Both are given automatically when the habit is added,
so a list is colourful without anyone choosing anything, and both can be changed afterwards.

## 1. Two more fields, the way v4 added `schedule`

`lib/types.ts` gains `icon: string | null` and `colour: string | null`, and they follow exactly
the rule v4 Block B wrote for `schedule`, for the same two reasons:

- **Stored as text, kept verbatim.** A phone runs the build it last loaded. If v6 adds an icon
  this build has never heard of and this build rewrote it to "none", the next tick or rename here
  would upload that and erase it everywhere. Unknown values pass through untouched and merely
  render as the default while they are here.
- **`null` is the only default.** A habit from before v5 and a habit explicitly set back to plain
  are the same row, so a round trip compares equal and sync does not re-upload the world.

Added without a storage version bump, as `position` was in v3 and `schedule` in v4.

## 2. `lib/look.ts` — one place that decides what a habit looks like

Pure, no React, no clock:

- `HABIT_COLOURS` / `HABIT_ICONS` — the closed sets this build knows.
- `isStoredLook` — shape only (`^[a-z][a-z0-9-]{0,23}$`), not a membership test, so a future
  value is not locked out and nonsense still cannot reach the database.
- `parseColour` / `parseIcon` — lenient; anything unreadable is the default.
- `guessIcon(title)` — a small keyword map, so "Drink water" arrives as a droplet and "Run" as
  footprints. No match is not a failure; it falls back to the colour alone.
- `resolveColour` / `resolveIcon` — what to actually draw: the value chosen for the habit, else
  a derived one.

**Changed while building, and it is the better design.** The plan above said a new habit would be
*given* a stored colour in `ADD_HABIT`. That is wrong twice: every habit that already exists would
have stayed grey for ever, and backfilling them on read means a write on load, an upload of every
row, and two devices racing to pick. So an un-chosen colour is **derived from the habit's id** and
an un-chosen icon **guessed from its title**, at draw time. Nothing is stored until somebody
chooses, every existing habit gets a face the moment the build loads, and every device agrees
because an id never changes.

## 3. Where it shows

- **The check circle** carries it: the habit's colour as the ring, its icon inside, when not done.
  Done is unchanged — filled circle, white tick — so the one signal that matters never depends on
  colour, and the tap target and interaction are untouched.
- **The streak badge** takes the habit's colour.
- The day strip stays neutral. Seven coloured dots per row across six habits is noise, and the
  strip's job is a pattern, not an identity.

## 4. The sheet becomes the habit's editor

The `⋯` menu is full — four pills already only just fit beside a title at 375px — so Block A does
not add a fifth. The **When** pill becomes **Edit**, and `ScheduleSheet` is retitled from "When?"
to the habit's own name with three sections: **Look**, **How often**, **Remind me**. The two
existing sections are untouched; this is one new section above them and a new title.

## 5. Contrast is the real work

Every colour is checked against the card in both themes by `lib/contrast.test.ts`, which is why
the palette is defined as tokens with light and dark values rather than Tailwind's stock colours.
An icon is a graphical object (3:1) but a filled badge carries text (4.5:1), and v4 already found
one pairing at 3.39:1 by measuring rather than trusting. Every new pair gets a row.

## 6. Tests

`lib/look.test.ts` (parse, guess, `nextColour` spreading across the palette, unknown values
surviving), `lib/storage.test.ts` (a habit saved before v5 reads back with both fields `null`),
`store/reducer.test.ts` (a new habit is given a look; `SET_LOOK` is a no-op when nothing changes,
so `updatedAt` is not bumped; `touchedBy` knows the new action or the build fails),
`supabase/tests/look.test.ts` (the columns, the shape check, and an older build's upload leaving
them alone — the v4 Block B proof, repeated), component tests for the circle and the new section,
and a browser test that adds a habit and sees it arrive with a colour.

### Then: write `docs/qa/v5-a-habit-look.md` and stop
