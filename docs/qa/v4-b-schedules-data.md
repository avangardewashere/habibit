# Habibit: v4 Block B, schedules — the data

**Block:** B of 6 (v4) · **Date:** 2026-09-30 · **Status:** ✅ all green locally — waiting for CI and your sign-off

> **A habit can now say how often it is meant to be kept.** In its `⋯` menu there is **Days**,
> which opens *How often?*: every day, certain days, or a few times a week. The choice is stored,
> synced and kept.
>
> **Nothing about today's list changes yet.** That is Block C. This block is the data and the one
> rule everything later depends on — *is this habit due on this date?*

**Legend:** ✅ pass · 🔴 **proven**: shown to fail when the guard was deliberately broken

---

## Your decision

| Question | Your choice |
|---|---|
| Which kinds of schedule | **Every day · certain days · N times a week** |

---

## What this block found, before any of it shipped

### 1. Our daylight-saving tests could never have caught a daylight-saving bug

The whole suite is pinned to **UTC+8**, on purpose, so that "today" means the same thing on every
machine. But UTC+8 has **no daylight saving at all** — so every test we have ever written "for DST"
was passing without exercising a single clock change.

I only noticed because I wrote one that failed: a guard asserting the timezone had really been
switched. The switch hadn't worked. On Windows, changing the timezone from inside a test is ignored,
so those tests had quietly run in UTC+8 and proved nothing.

**There is now a second test run** (`npm run test:dst`) pinned to **Santiago**, where the clocks go
forward **at midnight**: on 2026-09-06 local midnight does not exist, and a date built at midnight
slides into the day before. It has its own config, its own files (`*.dst.test.ts`), its own CI step,
and its first test checks the timezone really did change, so it can never go vacuous again.

Proven: stepping days by `86_400_000` milliseconds instead of by the calendar makes the week around
a 25-hour Sunday **lose a day** — `2027-04-04` comes back as `2027-04-03`, and the DST run goes red.
That is the v1 trap, still caught, now for real.

### 2. The day buttons would have failed contrast — the same trap as Block A, in a new place

A chosen day was going to use the accent colour with white on it, like the tick in a checked circle.
Measured, that pair is **3.39:1 in light mode**. That is fine for the tick, because a tick is a
shape and shapes need 3:1 — but these buttons carry a **letter**, and text needs 4.5:1.

They now use the all-done badge's colours, which the contrast test already holds to 4.5:1 in both
themes, and the new pairing is in `lib/contrast.test.ts` so it cannot drift back.

### 3. The menu stayed open behind the sheet, and ate the next tap

Found by V4B-53, not by hand: after choosing days and closing the sheet, the row underneath was
still showing its Rename / Days / Archive / Delete pills — and the first tap back on the habit was
swallowed closing that menu instead of ticking it. Tapping **Days** now closes the menu on the way
out.

### 4. The browser tests were quietly testing someone else's app

`npm run e2e` reuses a server already listening on port 3100, and only checks that *something*
answers. Another project of yours was on 3100, so every test failed looking for a page that was
never there. `HABIBIT_E2E_PORT` now lets a run pick another port; nothing of yours was touched.

---

## The risk v4's plan singled out, and how it is answered

> *"An installed copy of the app can be days out of date… an older copy that doesn't know about
> `schedule` will leave it out of both what it reads and what it writes."*

Sync copies **named columns only**. Reading the code says a schedule should survive an older
device's upload, because an upsert only overwrites the columns it sends. v3 taught us not to trust
that kind of reasoning, so both directions are tested against a real Postgres:

| The case | What must happen | Test |
|---|---|---|
| A phone still on v3 renames a habit | the schedule stays | V4B-61 🔴 |
| A **newer** build set a schedule this one can't read, and this one renames the habit | the schedule stays, untouched | V4B-63 🔴 |

The second case is why a schedule is stored as **text and kept verbatim**, rather than parsed into
an object the app then writes back. If this build turned "every third day" into "every day" on
reading it, the next rename or tick made here would upload that and erase the choice on every
device. Unreadable schedules pass straight through, and merely behave as *every day* while they are
here.

Storing text has a second reason: sync decides what to upload by comparing records as text. A schedule
stored as JSON could come back with its keys in another order, look like an edit, and re-upload every
habit for ever — the v3 Block B bug, waiting in a new place (V4B-41).

---

## How it works

| Piece | Where | Job |
|---|---|---|
| The rule | `lib/schedule.ts` — `isDueOn` | **is this habit due on this date?** Nothing else decides |
| The wording | same — `parseSchedule` / `formatSchedule` | text ⇄ schedule, one canonical form |
| The column | `supabase/migrations/…_habit_schedule.sql` | nullable text, shape-checked, NULL = every day |
| The choosing | `components/habit/ScheduleSheet.tsx` | the *How often?* sheet |
| The writing | `store/reducer.ts` — `SET_SCHEDULE` | stores it, syncs it |

**Every day is stored as nothing at all.** A habit made before v4 and a habit you explicitly set
back to every day are the same row, so neither can ever look like an edit of the other.

**N times a week does not count the day you are looking at.** Tick a three-times-a-week habit and it
stays due today — otherwise it would vanish out from under your thumb the moment you tapped it. It
stops being due once *three other days* that week are kept, and the count starts again on Monday.

**A habit can never end up due on no days.** Turning off the last day is refused, and "all seven
days" is just every day.

**The database check does not list the kinds we know.** A later version will add kinds, and a
database that refused them would have to be migrated in lock-step with every phone. It checks the
shape only — lowercase kind, optional argument, sane length — so nonsense can't be stored while the
meaning stays the app's business.

---

## Tests

| ID | What it proves | Test | Result |
|---|---|---|---|
| V4B-01 | ⭐ A habit with nothing stored is every day | `lib/schedule.test.ts` | ✅ |
| V4B-02 | ⭐ Every schedule survives being written and read back | same | ✅ |
| V4B-03 | ⭐ Two devices that pick the same days write the same text | same | ✅ 🔴 |
| V4B-04 | Every day has exactly one stored form: nothing | same | ✅ |
| V4B-05 | A nonsense number of times a week is every day, not no days | same | ✅ |
| V4B-06 | ⭐ A schedule this build has never heard of reads as every day | same | ✅ 🔴 |
| V4B-07 | ⭐ …and is still worth keeping, so it is not erased | same | ✅ |
| V4B-08 | But nonsense is not kept at all | same | ✅ |
| V4B-09 | A schedule says what it is, in words | same | ✅ |
| V4B-10 | Every day is due every day | same | ✅ |
| V4B-11 | ⭐ Chosen weekdays are due on exactly those days, fortnight after fortnight | same | ✅ 🔴 |
| V4B-12 | ⭐ The weekday is right across a month, a year and a leap day | same | ✅ |
| V4B-13 | A habit due on no days is impossible: it reads as every day | same | ✅ |
| V4B-14 | ⭐ N times a week is due until the week has enough kept days | same | ✅ |
| V4B-15 | ⭐ Ticking it today does not make it stop being due today | same | ✅ 🔴 |
| V4B-16 | ⭐ The count starts again on Monday | same | ✅ 🔴 |
| V4B-17 | Days in the weeks either side are not counted | same | ✅ 🔴 |
| V4B-18 | Asked without any history, it is due | same | ✅ |
| V4B-19 | Once a week is due all week until it is kept | same | ✅ |
| V4B-20 | Weeks run Monday to Sunday | same | ✅ |
| V4B-21 | A week crossing a month or year still has seven days | same | ✅ |
| V4B-22 | The daylight-saving run really is in a DST timezone | `lib/schedule.dst.test.ts` | ✅ |
| V4B-23 | ⭐ The weekday is right on a day that has no midnight | same | ✅ |
| V4B-24 | ⭐ The week around it still has seven days, in order | same | ✅ 🔴 |
| V4B-25 | ⭐ Clocks going back neither repeat nor lose a day | same | ✅ 🔴 |
| V4B-30 | ⭐ A habit starts as every day | `store/schedule.test.ts` | ✅ |
| V4B-31 | ⭐ Choosing days stores them, and counts as an edit | same | ✅ |
| V4B-32 | ⭐ Going back to every day clears it rather than storing "daily" | same | ✅ 🔴 |
| V4B-33 | ⭐ Choosing the schedule it already has changes nothing | same | ✅ 🔴 |
| V4B-34 | A deleted habit cannot be given a schedule | same | ✅ |
| V4B-35 | ⭐ A schedule change is sent to the account | same | ✅ |
| V4B-36 | ⭐ A schedule is still there after a reload | same | ✅ |
| V4B-37 | ⭐ A newer build's schedule survives a reload here, unchanged | same | ✅ |
| V4B-38 | Habits saved before v4 read as every day | same | ✅ |
| V4B-39 | ⭐ A schedule the app cannot read round-trips through the account | same | ✅ 🔴 |
| V4B-40 | A stored value that is not a schedule at all is dropped | same | ✅ |
| V4B-41 | ⭐ A habit read back from the account is not uploaded again | same | ✅ |
| V4B-42 | ⭐ The sheet says what the habit is set to now | `components/habit/ScheduleSheet.test.tsx` | ✅ |
| V4B-43 | ⭐ A habit with nothing set reads as every day | same | ✅ |
| V4B-44 | ⭐ Choosing certain days starts with today, never with no days | same | ✅ |
| V4B-45 | ⭐ Turning days on and off writes each change | same | ✅ |
| V4B-46 | ⭐ The last day cannot be turned off | same | ✅ 🔴 |
| V4B-47 | ⭐ A few times a week can be chosen, and how many | same | ✅ |
| V4B-48 | Going back to every day clears the schedule | same | ✅ |
| V4B-49 | Escape closes it, and there is nothing to save | same | ✅ |
| — | Both day-button colours reach 4.5:1 in both themes | `lib/contrast.test.ts` | ✅ 🔴 |
| V4B-60 | ⭐ A schedule is stored, and reaches another device | `supabase/tests/schedule.test.ts` | ✅ 🔴 |
| V4B-61 | ⭐ An older build's upload leaves the stored schedule alone | same | ✅ 🔴 |
| V4B-62 | A habit an older build created reads back as every day | same | ✅ |
| V4B-63 | ⭐ A schedule kind this build can't read survives an edit made here | same | ✅ 🔴 |
| V4B-64 | The database refuses a schedule that isn't shaped like one | same | ✅ |
| V4B-65 | Two devices agree on a schedule change, latest wins | same | ✅ 🔴 |
| V4B-50 | ⭐ In a real browser: certain days sticks, and survives a reload | `e2e/schedule.spec.ts` | ✅ |
| V4B-51 | ⭐ A few times a week sticks too | same | ✅ |
| V4B-52 | ⭐ A habit can never end up due on no days at all | same | ✅ |
| V4B-53 | ⭐ Today's list is unchanged by a schedule (that is Block C) | same | ✅ 🔴 |
| V4B-54 | The sheet fits a phone, and every choice is a comfortable tap | same | ✅ |

---

## Mutation checks

Each guard broken on purpose, to see the test go red.

| Broken on purpose | Caught by |
|---|---|
| Chosen weekdays ignored — everything due every day | V4B-11, V4B-19 |
| N times a week counts the day itself | V4B-15, V4B-19 |
| "This week" means the last seven days, not Monday to Sunday | V4B-16, V4B-17 + 2 more |
| Chosen days not put in order before storing | V4B-03 |
| An unknown schedule guessed at instead of left alone | V4B-06 |
| An unknown schedule erased when read from the account | V4B-39, V4B-60, V4B-63, V4B-65 |
| Choosing the same schedule again counts as an edit | V4B-33 |
| Every day stored as the text "daily" | V4B-32 |
| The last chosen day can be turned off | V4B-46 |
| Days stepped by milliseconds instead of by the calendar | V4B-24, V4B-25 (the DST run) |
| A day chosen in the sheet uses the accent colour | the contrast test |
| The old build *does* send the schedule column | V4B-61 |
| The menu left open behind the sheet | V4B-53 |
| `touchedBy` missing `SET_SCHEDULE` | **compile error** |

**Thirteen guards, thirteen caught** — twelve by tests, one by the type checker. Source files were
verified byte-identical to the originals afterwards.

---

## Known limits

- **Nothing on today's list changes yet.** A habit due on Mondays still shows every day, with a
  streak counted the old way. That is Block C, deliberately: this block is the data and the rule.
- **N times a week needs the week's ticks to answer "due?"**, and today nothing passes them in — the
  rule takes them as an argument and defaults to "due". Block C wires it to real history.
- **The schedule isn't visible on the list**, only inside the sheet and in the Days button's
  accessible name. Also Block C.
- **No "every N days"** (every other day, every third day). It was the third option when you chose,
  and it stays out of v4.
- **A schedule written by a newer build shows as "Every day" here** while it passes through. It
  cannot be otherwise without teaching this build what it means — and it is never erased.

---

## Totals

| Suite | Count | Result |
|---|---|---|
| Unit (Vitest) | 456 | ✅ |
| Daylight saving (new run) | 4 | ✅ |
| Database | 70 | ✅ |
| Browser (Playwright), 112 tests × 2 devices | 224 runs | ✅ |

All green on this machine, including the database suite against a local Supabase. CI runs the same
four.
