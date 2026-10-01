# Habibit: v4 Block F, per-habit reminders — sending them

**Block:** F of 6 (v4) · **Date:** 2026-10-02 · **Status:** ✅ all green on CI (run 36807930704), first try — waiting for your sign-off, and one check only a real phone can do

> **The reminders you turned on in Block E now actually go out.** The sender wakes every quarter
> hour as before, and now claims two lists: the account-wide nudge, and one reminder per habit that
> asked — **on the days that habit is due**, and only if it isn't already done.
>
> This is the last block of v4.

**Legend:** ✅ pass · 🔴 **proven**: shown to fail when the guard was deliberately broken

---

## The decision in this block

**A habit with its own reminder is no longer counted by the daily nudge.** Otherwise the same habit
gets talked about twice: by name at eight in the morning, and again inside *"2 habits left today"*
in the evening. Asking to be reminded about something separately reads as "don't count this one in
the summary". If every unfinished habit has its own reminder, the nudge has nothing left to say and
doesn't arrive at all (V4F-54, V4F-55).

**Say the word if you'd rather keep it in both.** It is one clause in one function, and the tests
that pin it would simply be inverted.

---

## What this block found, before any of it shipped

### Two reminders at the same time would have become one

Every notification Habibit sends carried the same tag — v3's deliberate choice, so that a week of
unopened nudges is one line on your lock screen rather than seven. For **per-habit** reminders that
rule is wrong: two habits due at eight o'clock would have silently collapsed into one, and the
second habit would look like the sender was broken.

Each habit's reminder now carries its own tag, so they arrive as separate notifications, while
tomorrow's reminder for *that* habit still replaces today's unread one. The service worker only
accepts a tag that looks like one of ours (V4F-20, V4F-21).

### A rule that is written twice can drift, and one half had no test

"Is this habit due today?" now exists in TypeScript (`lib/schedule.ts`, for the app) **and** in SQL
(`habit_due_on`, for the sender) — the cost of deciding who to wake inside the database rather than
dragging every habit out of it.

A mutation check made the SQL version count *today* towards its own weekly target, which contradicts
the app's rule — and every test still passed. The sender's own query hides the case, because it
drops habits already done before the question is asked. **V4F-58 now asks the rule directly**, and
the broken version fails.

---

## How it works

| Piece | Where | Job |
|---|---|---|
| Is this habit due today? | `…_habit_reminder_sender.sql` — `habit_due_on` | Block B's rule, in SQL |
| Which reminders are due now | same — `habit_reminders_due` | time, timezone, schedule, already done |
| Taking them | same — `claim_due_habit_reminders` | marks `last_sent_on` before handing them over |
| The daily nudge | same — `reminders_due`, replaced | now ignores habits that tell you themselves |
| What it says | `functions/send-reminders/reminders.ts` | names the habit only when that habit may |
| Sending it | `functions/send-reminders/index.ts` | two claims, one pass, one device list |
| Showing it | `public/sw.js` | a tag per habit, so two don't become one |

**Due means all of this:** the reminder is on · the time has passed **on your clock**, by less than
two hours · nothing has been sent for *this habit* today · the habit is due today by its own
schedule · you haven't already done it · it is neither archived nor deleted.

**The two-hour window is v3's**, for v3's reason: a sender that was down for ten minutes still
catches you, and one that was down overnight doesn't wake you at breakfast.

**Marking before sending is v3's too.** A reminder that fails and is never retried costs one nudge;
one sent twice is how an app's notifications get switched off for good.

**A per-habit reminder doesn't need the daily nudge to be on.** It only needs the timezone row,
which is where "your clock" is written down.

**Nothing new to schedule.** The same quarter-hourly job wakes the same function; it now claims two
lists each time.

---

## Tests

| ID | What it proves | Test | Result |
|---|---|---|---|
| V4F-01 | ⭐ A reminder says nothing about the habit unless that habit may | `functions/send-reminders/reminders.test.ts` | ✅ 🔴 |
| V4F-02 | ⭐ It names it when it may | same | ✅ 🔴 |
| V4F-03 | A very long name is cut, not spilled across the lock screen | same | ✅ |
| V4F-04 | A title of only spaces falls back rather than saying "Time for ." | same | ✅ |
| V4F-05 | ⭐ Every device of that person gets it | same | ✅ |
| V4F-06 | ⭐ Two habits at once are two notifications, each worded its own way | same | ✅ 🔴 |
| V4F-07 | ⭐ One device failing doesn't stop anybody else | same | ✅ |
| V4F-08 | ⭐ A send that throws is a failure, not the end of the run | same | ✅ |
| V4F-09 | A dead address is reported for deleting; so is someone with no device | same | ✅ |
| V4F-20 | ⭐ Two habits due at the same time are two notifications, not one | `lib/offline/sw-push.test.ts` | ✅ 🔴 |
| V4F-21 | ⭐ A tag that isn't one of ours is ignored rather than trusted | same | ✅ 🔴 |
| V4F-40 | ⭐ A habit whose time has come, on a day it is due | `supabase/tests/habit-reminders-due.test.ts` | ✅ |
| V4F-41 | ⭐ Nothing before the time, nothing more than two hours after | same | ✅ 🔴 |
| V4F-42 | ⭐ On your clock, not the server's | same | ✅ 🔴 |
| V4F-43 | ⭐ A habit already done today is not reminded about | same | ✅ 🔴 |
| V4F-44 | ⭐ A Mon/Wed/Fri habit is reminded on Mon, Wed and Fri only | same | ✅ 🔴 |
| V4F-45 | ⭐ A twice-a-week habit stops at its target, and starts again on Monday | same | ✅ 🔴 |
| V4F-46 | ⭐ A schedule this database can't read is reminded, not dropped | same | ✅ 🔴 |
| V4F-47 | An archived or deleted habit is never reminded about | same | ✅ |
| V4F-48 | ⭐ A nonsense timezone costs that person their reminder, nobody else theirs | same | ✅ |
| V4F-49 | ⭐ Claiming marks it sent, so a second run sends nothing | same | ✅ 🔴 |
| V4F-50 | ⭐ Each habit is claimed on its own | same | ✅ 🔴 |
| V4F-51 | ⭐ The naming choice travels with the reminder | same | ✅ |
| V4F-52 | A per-habit reminder works whether or not the daily nudge is on | same | ✅ |
| V4F-53 | ⭐ Nobody but the sender can ask, or claim | same | ✅ |
| V4F-54 | ⭐ A habit with its own reminder isn't counted by the daily nudge | same | ✅ 🔴 |
| V4F-55 | ⭐ With every unfinished habit speaking for itself, no nudge arrives | same | ✅ 🔴 |
| V4F-56 | Turning a habit's reminder off puts it back in the daily count | same | ✅ |
| V4F-57 | ⭐ The SQL rule: every day, chosen weekdays, and anything unreadable | same | ✅ |
| V4F-58 | ⭐ The day asked about never counts towards its own weekly target | same | ✅ 🔴 |
| V4F-59 | ⭐ The week it counts is Monday to Sunday | same | ✅ |

---

## Mutation checks

| Broken on purpose | Caught by |
|---|---|
| Every reminder names its habit | V4F-01, V4F-06 |
| Every habit shares one notification tag | V4F-01, V4F-02 |
| The worker ignores the sender's tag | V4F-20 |
| The worker trusts any tag it is given | V4F-21 |
| The schedule is ignored: everything is due every day | V4F-44, V4F-45 |
| A habit already done today is still reminded about | V4F-43 |
| The two-hour window is unbounded | V4F-41, V4F-42 |
| The daily nudge counts habits that tell you themselves | V4F-54, V4F-55 |
| Claiming doesn't mark it sent | V4F-49, V4F-50 |
| An unknown schedule hides the habit instead of reminding | five tests |
| The weekly count includes the day being asked about | V4F-58 |

**Eleven guards, eleven caught** — the last of them only after the mutation went through unnoticed
and the missing test was written.

---

## The one thing tests can't do: your optional check

Everything above runs against a real Postgres, but **no test here has ever made a phone buzz** — a
real push needs a real push service, a deployed function and a real VAPID key. When the deploy is
fixed and the function is live:

1. Open a habit's **When** sheet, turn **Remind me** on, and set it **two quarter-hours ahead**.
   Leave *Say the habit's name* off.
2. Lock the phone. At that time, a notification should say **"Time for one of your habits."** — and
   nothing about which one.
3. Turn naming **on**, set it two quarter-hours ahead again, and check it says the habit by name.
4. Set the habit to **certain days**, pick a day that isn't today, and set a time two quarter-hours
   ahead. **Nothing should arrive.**
5. Tick the habit before its time comes round. **Nothing should arrive.**

Nothing in this block is marked passed on the strength of those; they are yours to run.

---

## Known limits

- **Sending is still unverified end to end.** The VAPID pair, the deployed function and the cron job
  are all set up by hand, and none of them exists yet (see `docs/qa/v3-g-launch.md`).
- **One reminder per habit per day.** No "remind me again in an hour".
- **A reminder fires on the two-hour rule, not exactly on the quarter hour** if the sender was late.
- **The daily nudge now says less** when habits have their own reminders — deliberate, and the one
  decision in this block worth disagreeing with.
- **`index.ts` is still outside the type checker**, as in v3: it runs on Deno and imports things this
  repo's TypeScript doesn't know. Everything it decides lives in `reminders.ts`, which is tested.

---

## Totals

| Suite | Count | Result |
|---|---|---|
| Unit (Vitest) | 540 | ✅ |
| Daylight saving | 9 | ✅ |
| Database | 99 | ✅ |
| Browser (Playwright), 124 tests × 2 devices | 248 runs | ✅ |

All four green on this machine, the database ones against a local Supabase in Docker, and all four
green on CI (run 36807930704) first try.
