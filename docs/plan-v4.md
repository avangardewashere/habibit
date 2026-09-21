# Habibit v4: Habits that fit a real week

**Goal:** make Habibit fit how habits actually work. Not every habit is daily, a habit has a
history longer than a month, a slip of the thumb shouldn't need a confirmation to prevent it, and
"remind me" means different things for different habits.

## Before v4 starts

**Planned as:** v3's launch is finished first, so v4 ships into a launch that works.

**Changed on 2026-09-22, your call:** v4 started before the launch finished. The one blocker was a
Vercel setting that wasn't reaching the production build, and Block A (undo) doesn't depend on
accounts being live, so nothing in it is held up. The launch items below still stand; they just no
longer gate v4.

- ☐ The account button is live — `npm run smoke` goes 16 for 16 (V3G-56 is the one red check)
- ☐ Sign-in email arrives (SMTP)
- ☐ Site URL and redirect URLs set in Supabase
- ☐ A reminder has arrived on your locked Android phone

These still need doing before anyone else is told about the app.

## Decisions locked

| Decision | Choice |
|---|---|
| Features | **Flexible schedules, longer history, undo, per-habit reminders** — all four |
| Timing | Planned for after v3 went live; **started early, 2026-09-22**, by your decision |
| Undo | **Six seconds** (asked at the start of Block A) |
| Not in v4 | Data export, sharing or social features, anything needing a paid service |

Sign-off works as in v2 and v3: each block ends with a report in `docs/qa/`, rows are automated
tests, each new guard is shown to go red when broken, and the few things only a real phone can prove
go in an *optional checks* list, never marked passed on your behalf.

## Decisions still open

These change what gets built, so they are asked at the start of the block that needs them — the
same way v3 asked about Arrange mode before Block B. My recommendation is first in each.

| Question | Asked in | Options |
|---|---|---|
| Which kinds of schedule? | B | **Every day / chosen weekdays / N times a week** · weekdays only |
| A habit that isn't due today: hidden or shown? | C | **Shown, dimmed, under the ones that are** · hidden entirely |
| Does a per-habit reminder name the habit? | E | **Yes, if you choose it per habit** · never |

The third one is a real tension, not a formality. Block E of v3 decided a notification **never names
the habit**, because a lock screen is public. A per-habit reminder that can't say which habit is
barely a reminder. Letting you choose, per habit, keeps the private default and makes the useful
version possible.

## Six blocks

| Block | Delivers | Size |
|---|---|---|
| **A: Undo** | A delete can be taken back for a few seconds | Small |
| **B: Schedules, part 1** | A habit can have a schedule; it's stored, synced and editable | Medium |
| **C: Schedules, part 2** | Today, streaks and the review all respect the schedule | Large |
| **D: Longer history** | A year at a glance, all-time best streak, since you started | Medium |
| **E: Per-habit reminders, part 1** | Turn on a reminder for one habit, at its own time | Medium |
| **F: Per-habit reminders, part 2** | The sender sends them, on the days each habit is due | Large |

**The order is deliberate.** Undo stands alone and is small, so it comes first — the same reason
v3 opened with the theme menu. Schedules come next because **everything after depends on one
question: is this habit due today?** Streaks, history and reminders all ask it. Answer it once, test
it hard, and the later blocks build on it rather than each inventing their own version.

---

## Block A: Undo

*Delete becomes forgiving.*

Today, deleting is `⋯` then **Delete** — and that's final. A stray tap on Delete throws away a
habit's whole history, with no way back.

*(Corrected at the start of Block A: this plan first said "Delete, then Delete again to confirm". It
isn't — the `⋯` menu also holds Rename and Archive, so it stays. What was missing was a way back.)*

- After a delete, a bar at the bottom offers **Undo** for six seconds (your choice).
- Deleting is already a soft delete (`deleted_at`), so undo is clearing it — no data is really gone
  until the bar disappears.
- **It has to survive sync.** Edits go to the account after 1.5 seconds, so a delete may already
  have been sent before you tap Undo. That's fine *only because* the latest change to a record wins:
  the undo is a newer change and beats the delete. A test must prove this, including the case of
  another device syncing in between.
- Habits and tasks both get it. **Delete account does not** — it stays a deliberate, confirmed,
  irreversible step, and the tests will say so.

**Tests:** delete then undo restores the item exactly, history included; undo after the delete has
already synced still wins; the bar goes away on its own; a second delete replaces the first bar
rather than stacking; the account-deletion flow is untouched.

---

## Block B: Schedules, part 1 — the data

*Nothing about today's list changes yet. A habit can simply carry a schedule.*

A schedule is one of:

- **Every day** — the default, and what every existing habit becomes, so nobody's list changes
- **Chosen weekdays** — Mon, Wed, Fri
- **N times a week** — three times, any days

It is written in the habit's edit menu, stored on the habit, and synced.

- **One pure function answers "is this habit due on this date?"** — in `lib/`, with no React, like
  `lib/date.ts`. Every later block calls it. It is where the unit tests concentrate, including the
  daylight-saving and week-boundary cases that caught v1 and v3 out.
- A migration adds the column; existing habits are "every day".

### The risk that matters most in v4

**An installed copy of the app can be days out of date.** A phone keeps running the version it last
loaded until it decides to update. Sync copies named fields only (`lib/sync/rows.ts`), so an older
copy that doesn't know about `schedule` will leave it out of both what it reads and what it writes.

Reading the code, the schedule should **survive on the server** — an upsert only overwrites the
columns it sends. But an older copy will **show a scheduled habit as daily** until it updates.

That is exactly the kind of thing that was reasoned about and wrong in v3 (records compared as text,
field order and all). So it is not assumed here: **Block B proves it with a test** that syncs from a
build that has never heard of schedules, and checks the schedule is still there afterwards.

**Tests:** the due-today function for every schedule kind across month, year and DST boundaries;
N-times-a-week counting across a week boundary; the schedule round-trips through sync; **an older
client's write does not erase it**; existing habits read as every day.

---

## Block C: Schedules, part 2 — what they change

*The block where schedules become visible, and the riskiest code in v4.*

- **Today's list** shows what's due first; habits not due today sit below, dimmed (subject to the
  open question above).
- **Streaks** stop counting days that weren't scheduled. A Mon/Wed/Fri habit ticked every Mon/Wed/Fri
  has an unbroken streak, even though Tuesday was never ticked. For N-times-a-week, the streak is
  counted in **weeks** — weeks where you met the target.
- **The 7-day strip and the 4-week review** show unscheduled days as neither done nor missed.

Streaks are where this can go quietly wrong: a streak that resets for no reason is the fastest way
to make someone stop trusting the app. So the streak rules get the same treatment the reminder time
zones got in v3 — an exhaustive table of cases, each one a test, and mutation checks on every rule.

**Tests:** streaks for every schedule kind across gaps, week boundaries and DST; unscheduled days
never break a streak and never count towards one; changing a habit's schedule doesn't rewrite its
past; the review marks unscheduled days distinctly.

---

## Block D: Longer history

*The review, beyond four weeks.*

- **A year at a glance** per habit: one small square per day, the way code-hosting sites show
  activity, so a year of a habit fits on a phone screen.
- **All-time best streak** — respecting the schedule, using Block C's rules rather than new ones.
- **Since you started:** how many times, over how long.

Completions are already stored by date, and have been since v0, so the data exists. The work is
showing it, and making sure a year of it stays fast to draw.

**Tests:** the year view lays out a year correctly, leap years included; best streak agrees with the
streak rules on every case from Block C; a habit started last week doesn't show a year of empty
squares as if they were missed.

---

## Block E: Per-habit reminders, part 1 — turning one on

- In a habit's menu: **Remind me**, at a time of your choosing.
- Stored per habit, synced, protected by the same "only your own rows" rules as everything else.
- **Whether the notification names the habit is chosen per habit** (subject to the open question),
  and off by default — the v3 privacy rule stays the default.
- The account-wide daily nudge from v3 stays. Per-habit reminders are *as well as*, not instead of.

**Tests:** database tests that nobody reads or writes another person's reminder; the naming choice
defaults to private; turning one off really stops it.

---

## Block F: Per-habit reminders, part 2 — sending them

The sender from v3 Block E grows from "one nudge per person" to "one per habit that asked, on days
it's due".

- **Who is due** stays in SQL, next to the data, exactly as in v3 — and now asks the Block B
  question: *is this habit scheduled today?* A Mon/Wed/Fri habit reminds you on Mon/Wed/Fri only.
- The v3 guards all carry over: never twice in one day, a late sender still catches you within two
  hours, and **one nonsense row never stops everybody else's reminders** — the bug v3 found.
- A habit already ticked today is not reminded about.

**Tests (database):** a habit due today is reminded, one not scheduled isn't; a ticked habit isn't;
never twice a day per habit; the account-wide nudge and a per-habit one don't double up for the same
habit; time zones and DST exactly as v3's tests; one bad row doesn't stop the rest.
**Tests (sender):** one failed device doesn't stop the rest; a named reminder says the name only
when asked to.

**Optional check, yours:** a reminder for one habit, two quarter-hours ahead, on a day it's
scheduled — then the same on a day it isn't, and nothing arrives.

---

## Not in v4

- **Data export.** Still worth having; the device copy stays the export for now.
- **Sharing, friends, public profiles.** A different kind of app.
- **Anything needing a paid service.** Everything above runs on the same free tiers as v3.
