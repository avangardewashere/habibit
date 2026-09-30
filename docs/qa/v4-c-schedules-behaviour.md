# Habibit: v4 Block C, schedules — what they change

**Block:** C of 6 (v4) · **Date:** 2026-10-01 · **Status:** ✅ green locally — waiting for CI and your sign-off

> **Schedules now do something.** A habit that isn't due today drops below the ones that are, in a
> quieter colour, saying *Not due today · Mondays*. Streaks stop counting the days in between: a
> Mon/Wed/Fri habit kept every Mon, Wed and Fri has an unbroken run. A few-times-a-week habit counts
> its run **in weeks**, and the badge says so.
>
> This is the block v4's plan called the riskiest, because a streak that resets for no reason is the
> fastest way to stop trusting a habit tracker.

**Legend:** ✅ pass · 🔴 **proven**: shown to fail when the guard was deliberately broken

---

## Your decision

| Question | Your choice |
|---|---|
| A habit that isn't due today | **Shown, dimmed, under the ones that are** |

---

## The two rules that needed a judgement call

### 1. A day you kept always counts as kept

Change a habit from every day to Mon/Wed/Fri and the Tuesdays in your history stop being days it was
due. **What you actually did is never rewritten**: a Tuesday you ticked still shows as done, still
counts towards the run, and no completion is touched — proved by comparing the whole completions map
before and after the change (V4C-16, V4C-17, V4C-31).

Going the other way, a day you *didn't* do that you were never due to do is not a miss, and is marked
apart from one everywhere it appears: on the strip, in the review, and in "Kept 4 of 12".

### 2. Ticking a habit never makes it vanish under your thumb

A twice-a-week habit that you've already done twice this week isn't due today — but if you tick it
*today*, today doesn't suddenly become a day it wasn't due. The day being looked at never counts
towards its own target (the rule from Block B), so the row stays where it is and moves down
tomorrow. V4C-53 pins that in a real browser, because the alternative — a row jumping out from under
a thumb mid-tap — is the kind of thing that only shows up when you use it.

---

## What changed on screen

| | Before | Now |
|---|---|---|
| The list | one list, any order you arranged | due today first, resting ones below in `ink-soft` |
| Why a row is quiet | — | *Not due today · Mon, Wed and Fri* under the title |
| The count | done out of **every** habit | done out of what's **due today**; hidden when nothing is |
| A streak | days in a row | days in a row, skipping days off — or **weeks** in a row |
| The 7-day strip | filled dot or empty ring | a third mark: a small quiet dot for a day off |
| The review | done · missed · before · future | …and **unscheduled**, counted in none of the totals |

**Dimmed means a colour, not an opacity.** 60% opacity on the ink colour over a card measures about
3.4:1, under the 4.5:1 this app holds text to. The resting rows use `ink-soft`, which the contrast
test already holds at 5.08 light and 5.20 dark — so "quieter" never becomes "harder to read". A
browser test asserts the two colours actually differ, so the dimming can't silently disappear either.

**The badge had to grow a unit.** "3" under a three-times-a-week habit means three weeks. On screen
it reads `3w`; to a screen reader, "3 weeks in a row".

---

## How it works

| Piece | Where | Job |
|---|---|---|
| Is it due? | `store/selectors.ts` — `isDue` | hands `lib/schedule.ts` the habit's own history |
| The split | same — `dueHabits`, `restingHabits` | what's on today's list, and what's resting |
| The run | same — `habitStreak` | days in a row, or weeks for N-times-a-week |
| The calendar | same — `reviewDay`, `habitReview` | a fifth kind of day: `unscheduled` |
| The drawing | `HabitSection`, `DayStrip`, `StreakBadge`, `ReviewSheet` | no rules of their own |

**The walk always ends.** Counting back day by day stops at the first day that was due and missed,
which always arrives because every schedule has at least one due day a week; the habit's own first
day is a second floor, so a new habit can't walk back through years that never existed. A run that
reaches further back than the habit — a day backfilled in the strip — is still counted, because it
really was kept.

---

## Tests

| ID | What it proves | Test | Result |
|---|---|---|---|
| V4C-01 | ⭐ Kept every Mon, Wed and Fri, the streak is unbroken | `store/streaks.test.ts` | ✅ 🔴 |
| V4C-02 | ⭐ The same history on an every-day habit is a streak of one | same | ✅ |
| V4C-03 | ⭐ A missed Wednesday does break it | same | ✅ 🔴 |
| V4C-04 | ⭐ An unfinished today doesn't break it, even when due | same | ✅ 🔴 |
| V4C-05 | ⭐ On a day it isn't due, the streak is the one it had | same | ✅ 🔴 |
| V4C-06 | ⭐ A day kept when it wasn't due still counts | same | ✅ 🔴 |
| V4C-07 | A run crosses a month boundary | same | ✅ 🔴 |
| V4C-08 | A new habit has no streak, and never looks back before itself | same | ✅ |
| V4C-09 | A habit never kept has no streak (and the walk ends) | same | ✅ |
| V4C-10 | ⭐ A few-times-a-week run is counted in weeks, and says so | same | ✅ 🔴 |
| V4C-11 | ⭐ A week still in progress cannot break the run | same | ✅ 🔴 |
| V4C-12 | ⭐ A finished week that fell short ends it | same | ✅ |
| V4C-13 | More than the target in one week is still one week | same | ✅ |
| V4C-14 | Hitting the target exactly counts; one short doesn't | same | ✅ 🔴 |
| V4C-15 | Once a week counts the weeks it was kept at all | same | ✅ 🔴 |
| V4C-16 | ⭐ Changing a schedule leaves every completion untouched | same | ✅ |
| V4C-17 | ⭐ A day no longer scheduled still counts as kept | same | ✅ |
| V4C-20 | ⭐ A Mon/Wed/Fri habit is due Wednesday, not Thursday | `store/today.test.ts` | ✅ |
| V4C-21 | ⭐ A few-times-a-week habit rests once the week's target is met | same | ✅ |
| V4C-22 | ⭐ Due habits first, then resting ones, each in display order | same | ✅ |
| V4C-23 | ⭐ The count counts only what is due today | same | ✅ |
| V4C-24 | ⭐ Keeping a habit on a day off never makes it read 3/2 | same | ✅ 🔴 |
| V4C-25 | Archived and deleted habits are in neither list | same | ✅ |
| V4C-26 | ⭐ A newer build's schedule shows as due, not hidden | same | ✅ |
| V4C-30 | ⭐ A day not due is marked apart from a miss | `store/review.test.ts` | ✅ 🔴 |
| V4C-31 | ⭐ A day kept when not due still reads as kept | same | ✅ 🔴 |
| V4C-32 | ⭐ "Kept N of M" counts only the days it was due | same | ✅ 🔴 |
| V4C-33 | ⭐ The best run carries straight through the days off | same | ✅ 🔴 |
| V4C-34 | ⭐ After a weekly target is met, the rest of the week is days off | same | ✅ 🔴 |
| V4C-40 | The badge says nothing at zero | `components/habit/StreakBadge.test.tsx` | ✅ |
| V4C-41 | ⭐ Days are counted in days | same | ✅ |
| V4C-42 | ⭐ Weeks in weeks, on screen and to a screen reader | same | ✅ 🔴 |
| V4C-43 | One of either reads as singular | same | ✅ 🔴 |
| V4C-44 | ⭐ The strip marks a day off apart from a day missed | `components/habit/DayStrip.test.tsx` | ✅ 🔴 |
| V4C-45 | ⭐ …and says which it is, out loud | same | ✅ 🔴 |
| V4C-46 | ⭐ A day off is still tappable; kept on one, it reads done | same | ✅ |
| V4C-47 | Today still has the ring when it's due | same | ✅ |
| V4C-60 | The daylight-saving run really is in a DST timezone | `store/streaks.dst.test.ts` | ✅ |
| V4C-61 | ⭐ A daily run survives the day that lost an hour | same | ✅ |
| V4C-62 | ⭐ …and the day that gained one | same | ✅ |
| V4C-63 | ⭐ A Mon/Wed/Fri run steps over the changed Sunday | same | ✅ |
| V4C-64 | ⭐ The weeks either side of a clock change are whole weeks | same | ✅ |
| V4C-50 | ⭐ In a real browser: a resting habit sits below, quieter, and says why | `e2e/schedule-today.spec.ts` | ✅ 🔴 |
| V4C-51 | ⭐ The count is of what's due, and a day-off tick can't break it | same | ✅ 🔴 |
| V4C-52 | ⭐ A streak counts due days, not the days between | same | ✅ |
| V4C-53 | ⭐ A weekly run reads in weeks, and the row stays put when ticked | same | ✅ |
| V4C-54 | ⭐ The strip's day off is marked apart, and stays tappable | same | ✅ |
| V4C-55 | ⭐ The review marks days off apart from misses | same | ✅ |

The v1 streak tests (`store/selectors.test.ts`) all still pass, now asking the new function. Their
meaning is unchanged: a habit with no schedule is a habit due every day.

---

## Mutation checks

| Broken on purpose | Caught by |
|---|---|
| Any missed day breaks the streak, scheduled or not | V4C-03, V4C-04, V4C-05, V4C-06, V4C-07 |
| A week still in progress breaks a weekly streak | V4C-11, V4C-14 |
| The count counts every habit again | V4C-24 |
| A day kept when not due is no longer shown as kept | V4C-31, V4C-32, V4C-33, V4C-34 |
| Days off counted as misses in "Kept N of M" | V4C-32, V4C-33 |
| Weeks reported as days | V4C-10, V4C-15 |
| The review never marks a day off | V4C-32, V4C-33, V4C-34 |
| The strip draws every day the same | V4C-44, V4C-45 |
| The badge always says "days" | V4C-42, V4C-43 |
| The list stops splitting due from resting | V4C-50, V4C-51 (in a real browser) |

**Ten guards, ten caught.** Source files verified byte-identical to the originals afterwards.

---

## Known limits

- **A schedule has no history.** Change it and the *picture* of the past changes with it: Tuesdays
  you once had to do become days off in the review. What you did is never altered — but Habibit
  can't show you "this was daily until September". Storing a schedule's history is not in v4.
- **Resting habits sit in the same card**, under the due ones, with no heading of their own. A
  heading would cost a row of space on a phone for something the colour and the caption already say.
- **A week that met its target four times over still counts as one week.** That is what "three times
  a week" asks for.
- **Nothing is due, nothing is counted.** With every habit resting, the header shows no fraction at
  all rather than "0/0".
- **The unit is a small `w`.** It is spelled out for a screen reader; sighted readers get one letter.

---

## Totals

| Suite | Count | Result |
|---|---|---|
| Unit (Vitest) | 493 | ✅ |
| Daylight saving | 9 | ✅ |
| Browser (Playwright), 118 tests × 2 devices | 236 runs | ✅ 160 ran here |
| Database | 70 | ⏳ CI |

**Two honest notes on the local run.** One test file's worker couldn't start on this machine (1.3 GB
free of 16 GB) — it passes on its own, twice, and its four tests are counted from those runs, not
from the run that never happened. And 76 browser runs skipped locally because the account tests need
the local Supabase, which is stopped to save memory; CI runs all 236 with it up, along with the
database suite.
