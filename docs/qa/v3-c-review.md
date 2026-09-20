# Habibit: v3 Block C, the review

**Block:** C of 7 (v3) · **Date:** 2026-09-20 · **Status:** ✅ all green on CI, waiting for your sign-off

> **You can finally look back.** A calendar button in the header opens the last four weeks, habit by
> habit: which days you kept, how many, and your best run in that stretch.

**Legend:** ✅ pass · 🔴 **proven**: shown to fail when the guard was deliberately broken

---

## Your decision

| Question | Your choice |
|---|---|
| How far back the review looks | **The last 4 weeks**: a 28-day calendar per habit, with days kept and the best run |

---

## The three choices I made inside that

**1. A sheet over the app, not a page of its own.** The service worker from v2 Block F caches the
one page this app has, so a sheet works with no signal for nothing extra (V3C-55). A second page
would have needed its own offline handling.

**2. Whole weeks, not "the last 28 days".** The window runs Monday to Sunday and ends with the week
you're in, so every column is one weekday and the shape is readable at a glance. When today isn't a
Sunday, the last row runs past today; those days are blank, and never counted against you.

**3. Reading only.** There's exactly one button in the sheet, and it closes it (V3C-24, V3C-52).
Backfilling a missed day stays on the main list's 7-day strip, where you meant to tap it. A
calendar of 28 small squares is the last place you want a stray thumb rewriting history.

---

## How a day is decided

| The square | What it means |
|---|---|
| Filled | Kept |
| Outline | Missed |
| Dimmed | **Before the habit existed**, or later this week |

That third case matters more than it sounds. A habit you started on Thursday didn't fail on the
Monday before it, and the count says so: **"Kept 3 of 5 days"**, not 3 of 28 (V3C-06, V3C-23). The
same goes for the days after today.

The counts and the best run are read out in a sentence under each habit's name, because the
calendar itself is a picture: a screen reader gets "Kept 14 of 28 days", not 28 squares.

---

## What it looks like

Checked in the browser pane at 375px, dark mode, with a month of seeded history:

- The button sits in the header beside the account and theme buttons.
- The sheet gives its date range ("24 Aug – 20 Sept"), then a card per habit: name, "Kept 14 of 28
  days", a flame with the best run, weekday letters, and four rows of seven.
- Today's square wears a ring, matching the 7-day strip on the main list.
- Escape closed it, focus went back to the button, and the page behind it could scroll again.

One thing I changed after looking: the "before it existed" squares were drawn in the faintest line
colour, which in dark mode is all but invisible, so a new habit's calendar looked like empty space.
They are now a dimmed outline: the grid keeps its shape without any of it reading as a miss.

---

## Tests

| ID | What it proves | Test | Result |
|---|---|---|---|
| V3C-01 | ⭐ Four Monday-to-Sunday weeks, ending with the week today is in | `store/review.test.ts` | ✅ 🔴 |
| V3C-02 | Every column is one weekday, Monday first, whatever day today is | same | ✅ 🔴 |
| V3C-03 | The 28 days run unbroken across a month end, a year end and a leap day | same | ✅ |
| V3C-04 | ⭐ Days before the habit existed are blank, not missed | same | ✅ 🔴 |
| V3C-05 | Days after today are blank too, and never counted | same | ✅ 🔴 |
| V3C-06 | ⭐ Counts only the days the habit could have been kept | same | ✅ 🔴 |
| V3C-07 | The best run is the longest inside the window | same | ✅ 🔴 |
| V3C-08 | A run that started before the window counts only its days inside it | same | ✅ |
| V3C-20 | The sheet opens from the header button, with focus on Close | `components/habit/ReviewSheet.test.tsx` | ✅ 🔴 |
| V3C-21 | Escape closes it and puts focus back on the button | same | ✅ 🔴 |
| V3C-22 | ⭐ The sentence gives days kept, days that counted, and the best run | same | ✅ 🔴 |
| V3C-23 | ⭐ A habit made mid-window has blank days before it, not misses | same | ✅ 🔴 |
| V3C-24 | ⭐ Nothing in the review can change your history | same | ✅ |
| V3C-25 | Archived habits are left out | same | ✅ 🔴 |
| V3C-50 | ⭐ In a real browser: opens over the app, 28 squares, closes again | `e2e/review.spec.ts` | ✅ |
| V3C-51 | Escape closes it and focus returns to the button | same | ✅ |
| V3C-52 | ⭐ The sheet has one button, and it closes it | same | ✅ |
| V3C-53 | ⭐ A habit made three days ago shows 24 blank days and "Kept 0 of 4 days" | same | ✅ |
| V3C-54 | At 375px the sheet fits, with no sideways scroll and a 44px close button | same | ✅ |
| V3C-55 | ⭐ The review opens with no connection | same | ✅ |

---

## Mutation checks

Each guard was broken on purpose, the tests run, and the file restored before the next run started.

| Broken on purpose | Caught by |
|---|---|
| Days before the habit existed count as missed | V3C-04, V3C-06, V3C-22, V3C-23 |
| Days after today count as missed | V3C-05 |
| Blank days are counted in the total | V3C-06, V3C-22 |
| The window is "the last 28 days" rather than whole weeks | V3C-02, and the mid-week test |
| The best run is just the number of days kept | V3C-07, V3C-22 |
| The sheet doesn't take focus when it opens | V3C-20 |
| Escape doesn't close the sheet | V3C-21 |
| Archived habits appear in the review | V3C-25 |

**Not mutation-checked:** the browser tests, which run only on CI.

---

## ⚠️ What CI found

Both were faults in my **test**, not in the review. Worth writing down, because both would have
passed quietly for a while and then failed for reasons that looked mysterious.

- **A seeded habit never appeared.** `seed()` takes the whole stored envelope — version number and
  all — and I handed it the bare data. The app did exactly what it should with data it can't
  recognise: quarantined it and started empty. The test then found nothing to count.
- **A count that only held on Sundays.** The test asked for 24 "before it existed" squares. On a
  Sunday the window ends today, so all 24 blanks are "before". Run on a Wednesday, four of them are
  "later this week" instead, and the test fails on a Wednesday for no good reason. It now counts
  the blanks together, and checks the split it actually cares about.

---

## Known limits

- **Four weeks, and no further back.** Older history is kept and still counts towards your streak;
  there is just no way to look at it yet. A longer view was explicitly out of scope for v3.
- **Archived habits aren't in the review.** Unarchive one and its whole history is there again.
- **The review is per habit.** No overall "you kept 74% this month" number — one more number to feel
  bad about, and not one you asked for.

---

## Totals

| Suite | Count | Result |
|---|---|---|
| Unit (Vitest) | 304 | ✅ |
| Browser (Playwright), 94 tests × 2 devices | 188 runs | ✅ CI run 35501225185 |
| Database | 34 | ✅ |

---

## Optional check, yours

On your phone, after this is merged: tap the calendar button in the header. Your four weeks should
be there, with today ringed. Then turn on airplane mode and open it again — it should still work.
