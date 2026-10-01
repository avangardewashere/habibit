# Habibit: v4 Block E, per-habit reminders — turning one on

**Block:** E of 6 (v4) · **Date:** 2026-10-01 · **Status:** ✅ all green on CI (run 36803523736), first try — waiting for your sign-off

> **One habit can now ask to be reminded, at its own time.** In a habit's `⋯` menu, **When** opens
> the sheet; under *How often* there is now **Remind me**: on or off, a time, and — your decision
> this block — whether the notification may say **which habit it is**, off unless you turn it on.
>
> The account-wide daily nudge from v3 is untouched. This is *as well as*, never instead of.
>
> Nothing is sent yet. The sender is Block F.

**Legend:** ✅ pass · 🔴 **proven**: shown to fail when the guard was deliberately broken

---

## Your decision

| Question | Your choice |
|---|---|
| May a reminder say which habit it is? | **Your choice, per habit — off by default** |

That keeps v3's rule for anyone who never thinks about it (*"Habibit — time for one of your
habits"*), and makes the useful version possible for the habits where it matters (*"Take
medication"*). The default is enforced in three places, each with its own test: the column's
default, what the app reads when the column says nothing, and what the switch shows.

---

## What this block found, before any of it shipped

### A brand-new habit could not be given a reminder

The first browser test failed on its first run. Turning a reminder on for a habit added seconds
earlier was refused by the database, and the switch flipped itself back.

The cause is honest and not obvious: **a reminder points at a habit row on the server**, and a habit
you just added is still in the outbox — edits go up 1.5 seconds after the last one. The foreign key
had nothing to point at yet.

Turning a reminder on now makes sure the habit has reached the account first. **Reading the code
would not have caught this**; the browser test did, which is the whole argument for having it.

### A gap in my own tests, found by the mutation checks

Breaking the privacy default one way — reading an *absent* `say_name` as "yes, name it" — passed
every test. Nothing fed the app a reminder row with that column missing, which is exactly what a row
written by an older build looks like. **V4E-24 now does**, and the broken version fails.

---

## How it works

| Piece | Where | Job |
|---|---|---|
| The table | `supabase/migrations/…_habit_reminders.sql` | one row per habit: on, time, may-say-name |
| The reading and writing | `lib/reminders/store.ts` | `loadHabitReminder`, `saveHabitReminder` |
| The switch | `components/habit/HabitReminder.tsx` | asks permission, registers the device, saves |
| Where it lives | `components/habit/ScheduleSheet.tsx` | the sheet is now **When?**: how often, and remind me |

**The `⋯` menu's pill is now "When" rather than "Days"**, because the sheet holds both. Four pills
still have to fit beside a title on a 375px phone, so the word had to stay short.

**One clock, in one place.** Which timezone your 8am is in stays in the account's reminder settings —
one person is in one place at a time, and a copy per habit would only create rows that disagree.
Switching a habit's reminder on writes *only* the timezone there, because an upsert touches just the
columns it sends: it can never turn the daily nudge on or off behind your back (V4E-20, V4E-47).

**Turning a reminder off keeps the row**, so the time and the naming choice are still there when it
goes back on.

**A reminder can only ever point at a habit of your own.** The foreign key includes the user, so
Bob cannot hang a reminder on Alice's habit even by guessing its id — and deleting a habit takes its
reminder with it.

---

## Tests

| ID | What it proves | Test | Result |
|---|---|---|---|
| V4E-01 | ⭐ It starts off, and says the daily nudge is unaffected | `components/habit/HabitReminder.test.tsx` | ✅ |
| V4E-02 | ⭐ Turning it on registers this device and saves the reminder | same | ✅ |
| V4E-03 | ⭐ Naming the habit is off by default; turning it on is explicit | same | ✅ |
| V4E-04 | ⭐ Turning it off keeps the time and the naming choice | same | ✅ 🔴 |
| V4E-05 | The time can be changed; only quarter hours are offered | same | ✅ |
| V4E-06 | ⭐ A failed write puts the switch back, and says so | same | ✅ |
| V4E-07 | ⭐ Refusing notification permission saves nothing at all | same | ✅ |
| V4E-08 | Signed out, it explains instead of offering a switch | same | ✅ |
| V4E-09 | Blocked notifications, or no key in the build: it doesn't pretend | same | ✅ |
| V4E-20 | ⭐ Switching one on writes only the timezone to the daily nudge | `lib/reminders/store.test.ts` | ✅ 🔴 |
| V4E-21 | ⭐ The row carries the habit, the time and the naming choice | same | ✅ |
| V4E-22 | ⭐ A habit with no row reads as off, and private | same | ✅ 🔴 |
| V4E-23 | With no account at all, nothing is read or written | same | ✅ |
| V4E-24 | ⭐ A stored row that says nothing about naming is private | same | ✅ 🔴 |
| V4E-40 | ⭐ A reminder is stored; naming is off unless asked for | `supabase/tests/habit-reminders.test.ts` | ✅ 🔴 |
| V4E-41 | ⭐ Nobody can read anyone else's reminders | same | ✅ 🔴 |
| V4E-42 | ⭐ Nor change one | same | ✅ 🔴 |
| V4E-43 | ⭐ A reminder can only point at a habit of your own | same | ✅ 🔴 |
| V4E-44 | ⭐ A signed-out visitor sees nothing at all | same | ✅ |
| V4E-45 | The database refuses a time that isn't a quarter hour | same | ✅ |
| V4E-46 | ⭐ Deleting the habit takes its reminder with it | same | ✅ 🔴 |
| V4E-47 | ⭐ Turning one on records your clock without touching the daily nudge | same | ✅ |
| V4E-48 | Turning one off keeps its time and naming choice | same | ✅ |
| V4E-50 | ⭐ In a real browser: a habit gets its own reminder, private by default, and it is still there when the sheet is reopened | `e2e/habit-reminder.spec.ts` | ✅ 🔴 |
| V4E-51 | ⭐ Signed out, the sheet says reminders need an account — and the schedule half still works | same | ✅ |

**One thing in V4E-50 is a stand-in.** `pushManager.subscribe()` really does ask Google's push
service for an address, which a test machine cannot reach, so that one call is replaced with a fake
subscription. Everything after it is the real thing: the real component, the real writes, the real
database, the real reload. Without the stand-in the switch could never be turned on in a test at
all, and the half that matters — what reaches the account — would go untested.

---

## Mutation checks

| Broken on purpose | Caught by |
|---|---|
| A reminder row that says nothing about naming reads as "name it" | V4E-24 |
| The timezone write also sends `enabled` | V4E-20 |
| Naming on by default in the app | V4E-22 |
| Naming on by default in the database | V4E-40, V4E-42 |
| The habit isn't synced before its reminder is saved | V4E-50 (browser) |
| Turning off forgets the time and the naming choice | V4E-04 |
| Anyone can read anyone's reminders | V4E-41 |
| A reminder need not point at your own habit | V4E-43, V4E-46 |

**Eight guards, eight caught** — and a ninth attempt found the hole described above rather than
being caught, which is the point of doing them. Source files verified byte-identical afterwards.

---

## Known limits

- **Nothing is sent yet.** Block F teaches the sender to send these, on the days each habit is due.
  Until then a reminder you turn on is a stored intention.
- **Notification permission is still device-wide.** The first habit reminder on a device asks for
  it, exactly as the account-wide switch does; refusing leaves everything off.
- **No "remind me again later".** One time per habit per day.
- **Turning a habit's reminder on also registers this device for the account's daily nudge**, since
  both use the same device record. Each is still switched on separately.
- **A reminder for an archived habit stays on.** Nothing sends yet, so nothing arrives; Block F
  decides what an archived habit's reminder should do.

---

## Totals

| Suite | Count | Result |
|---|---|---|
| Unit (Vitest) | 529 | ✅ |
| Daylight saving | 9 | ✅ |
| Database | 79 | ✅ |
| Browser (Playwright), 124 tests × 2 devices | 248 runs | ✅ |

All four suites green on this machine, the database ones against a local Supabase in Docker — and
for once the browser suite too, with none skipped. All four green on CI (run 36803523736), first try.
