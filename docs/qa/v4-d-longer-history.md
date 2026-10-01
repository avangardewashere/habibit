# Habibit: v4 Block D, longer history

**Block:** D of 6 (v4) · **Date:** 2026-10-01 · **Status:** ✅ all green on CI (run 36797325671), first try — waiting for your sign-off

> **The review goes back a year.** Two buttons at the top: **4 weeks** or **Year**. The year is one
> small square a day, a year to a screen, with the line underneath saying *Best ever 13 days in a
> row · kept 132 times over 11 months*.
>
> No new rules. Every number here reads the same schedule rules as the streak on the list, so the
> review and the badge can never contradict each other.

**Legend:** ✅ pass · 🔴 **proven**: shown to fail when the guard was deliberately broken

---

## What this block found, before any of it shipped

### 1. A twice-a-week habit was being marked out of every day of the year

Opening the year view on a habit kept twice a week showed:

> Gym — **Kept 0 of 347 days**

That is Block C's counting, read at a year's scale: for an N-times-a-week habit every day is "due"
until the week's target is met, so the totals counted 347 days it was supposed to have been done.
Nobody has ever meant that by "twice a week".

The review now counts those habits **in weeks**, the same unit the streak badge uses: *Kept 0 of 49
weeks*. A week counts once it is over, or as soon as its target is met — so the week in progress
never reads as a failure before it has finished, exactly as it never breaks a streak.

It was a real bug in what shipped as Block C, found by looking at the same data over a longer
window. Both views are fixed, not just the year.

### 2. A whole year read as three days

The sheet's date range showed **"29 Sept – 1 Oct"** for the year view, because the short date format
leaves the year out. Correct to the day and useless to read. The range now names both years when it
crosses one: *29 Sept 2025 – 1 Oct 2026*.

---

## How it works

| Piece | Where | Job |
|---|---|---|
| A year of squares | `components/habit/YearGrid.tsx` | 371 days, weeks down the columns |
| The best run ever | `store/selectors.ts` — `bestEver` | walks the habit's whole life, by Block C's rules |
| Since you started | same — `sinceYouStarted`, `firstDayOf` | how many times, over how long |
| Counting in weeks | same — `habitReview` | the fix above, for N-times-a-week habits |
| The words | `lib/date.ts` — `describeSpan`, `formatDateRange` | "11 months", and years in a range |

**53 weeks, not 52.** A year is 52 weeks and a day or two, so 52 Monday-to-Sunday columns would
always cut the far end off.

**The grid is a picture and is treated as one.** At 375px each square is about 4.7px — too small to
tap, so nothing in it is tappable, and it is hidden from screen readers, which get the sentence
above it instead. Days are changed in the seven-day strip on the main list, as before.

**A habit made last week shows a year of nothing**, not a year of misses: days before it existed are
blank, which is the difference between "you weren't doing this yet" and "you failed".

**The best run ever is the same walk as the streak**, applied to the whole history rather than the
recent end of it. V4D-06 pins them together: when the current run *is* the best one, both functions
must return the identical answer, for every kind of schedule.

---

## Tests

| ID | What it proves | Test | Result |
|---|---|---|---|
| V4D-01 | ⭐ The best run can be one from long before the last four weeks | `store/history.test.ts` | ✅ |
| V4D-02 | ⭐ It counts the schedule's days, not the calendar's | same | ✅ 🔴 |
| V4D-03 | ⭐ For a few-times-a-week habit it counts weeks | same | ✅ 🔴 |
| V4D-04 | ⭐ An unfinished today can't lower a best already achieved | same | ✅ |
| V4D-05 | A habit never kept has no best run | same | ✅ |
| V4D-06 | ⭐ When the current run is the best, both answers are identical | same | ✅ 🔴 |
| V4D-07 | ⭐ "Since you started" counts every tick, over the days since the first | same | ✅ |
| V4D-08 | A tick dated in the future is not something you have done | same | ✅ 🔴 |
| V4D-09 | ⭐ A day backfilled before the habit was made counts, and moves the start | same | ✅ 🔴 |
| V4D-10 | An untick is not a tick | same | ✅ |
| V4D-11 | ⭐ 53 whole weeks, Monday first, ending with this week | same | ✅ |
| V4D-12 | ⭐ A leap day appears once, and the run of days never skips | same | ✅ |
| V4D-13 | ⭐ A habit made last week shows a year of nothing, not of misses | same | ✅ |
| V4D-14 | ⭐ A few-times-a-week habit is counted in weeks, not days | same | ✅ 🔴 |
| V4D-15 | ⭐ The week in progress is not counted against it | same | ✅ 🔴 |
| V4D-20 | Spans get coarser as they get longer | `lib/date.test.ts` | ✅ |
| V4D-21 | A habit made today is never "0 days" old | same | ✅ |
| V4D-22 | ⭐ A range that crosses a new year names both years | same | ✅ 🔴 |
| V4D-40 | One square per day, tagged with what it means | `components/habit/YearGrid.test.tsx` | ✅ |
| V4D-41 | ⭐ A day before the habit existed is blank; a miss is not | same | ✅ 🔴 |
| V4D-42 | ⭐ A day off is quieter than a miss; a kept day is the accent | same | ✅ |
| V4D-43 | 371 squares are a picture, not something to read out | same | ✅ |
| V3C-24 | *(updated)* Every button changes the view, never your history | `components/habit/ReviewSheet.test.tsx` | ✅ |
| V4D-50 | ⭐ In a real browser: a whole year, and it says which year | `e2e/history.spec.ts` | ✅ |
| V4D-51 | ⭐ The year view adds the best run ever and how long you've been at it | same | ✅ |
| V4D-52 | ⭐ A habit made days ago shows a year of nothing | same | ✅ |
| V4D-53 | The year fits a phone, and both choices are comfortable taps | same | ✅ |
| V3C-52 | *(updated)* No day in the review is tappable | `e2e/review.spec.ts` | ✅ |

**Two tests changed meaning rather than breaking.** V3C-24 and V3C-52 asserted the review had
exactly one button, as a way of saying "you can't change history from here". There are three now
(close, and the two ranges), so both tests say the real thing instead: no day is tappable, and every
button changes only what you are looking at.

---

## Mutation checks

| Broken on purpose | Caught by |
|---|---|
| The best run is broken by days the habit wasn't due | V4D-02, V4D-06 |
| A day backfilled before the habit was made is ignored | V4D-09 |
| Ticks dated in the future are counted | V4D-08 |
| Weekly habits counted in days again (the bug above) | V4D-14, V4D-15 |
| The week in progress counted as a failure | V4D-14, V4D-15 |
| The year dropped from a range that crosses one | V4D-22 |
| A short week doesn't end the best weekly run | V4D-03 |
| Days before the habit existed drawn as misses | V4D-41 |

**Eight guards, eight caught.** Source files verified byte-identical to the originals afterwards.

---

## Known limits

- **No month labels along the top of the year.** There is no room for them at 375px, and the range
  under the title already says which year you are looking at.
- **No tooltip on a square.** It is a picture: ~4.7px a day, and a tap target that small would be a
  trap rather than a feature.
- **The year is 53 weeks (371 days)**, slightly more than a year, so that every column is one weekday.
- **"Best ever" reads the whole history each time the sheet opens.** At a few thousand days per
  habit that is nothing; if the app ever gets years of data for dozens of habits it is the first
  thing to measure.
- **Archived habits are still not in the review.** Unchanged from v3, and worth revisiting.

---

## Totals

| Suite | Count | Result |
|---|---|---|
| Unit (Vitest) | 515 | ✅ |
| Daylight saving | 9 | ✅ |
| Browser (Playwright), 122 tests × 2 devices | 244 runs | ✅ |
| Database | 70 | ✅ (untouched by this block) |

All four suites green on CI (run 36797325671), first try. 76 browser runs skipped locally: the account tests need the local Supabase, which is stopped to save
memory on this machine. CI runs all of them, with the database suite.
