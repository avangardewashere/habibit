# Habibit: v5 Block C, never opens empty

**Block:** C of 3 (v5) · **Date:** 2026-10-08 · **Status:** locally: 678 unit / 9 DST green; 12 of 16 browser checks run green, the 4 needing an account blocked by a broken local Supabase (see below); 12 of 13 mutation checks killed, 1 not runnable here. GitHub CI is the judge for the database and account suites. Waiting for your sign-off. Not merged, and nothing is deployed

> **A first-time visitor no longer meets an empty list.** Habibit opens on a welcome screen that
> says what it is, offers **"See it with sample habits"** (a believable couple of months, one tap
> away), and six one-tap starter habits. The sample is clearly marked as made up, can be cleared
> in one tap (with Undo), and **never reaches an account**: signing in clears it first.
>
> This is the last block of v5.

**Legend:** ✅ pass · 🔴 **proven**: shown to fail when the guard was deliberately broken

---

## The decisions in this block

| Decision | Choice | Whose |
|---|---|---|
| How a first visit meets the sample | **A welcome with a one-tap button**, not an app that opens already filled | yours, 2026-10-07 |
| Sample + signing in | **Cleared at sign-in**, said beforehand in the sign-in panel | yours, 2026-10-07 |
| How samples are recognised | A **reserved block of real UUIDs** (`5a3b1e00-0000-4000-8000-…`) | mine, below |
| Whether the sample is offered while signed in | **No** | mine, below |

**Why real UUIDs.** The database's habit `id` is a `uuid`. A sample id in any other shape would
fail an upload's whole batch, not just itself. One reserved block means "clear the sample"
removes exactly the sample and never anything you added.

**Why not offer it while signed in.** It would be cleared the moment it arrived, and offering
something that vanishes is a trick. Signed in, the welcome offers only the starters.

---

## What's in the sample

Six habits, one per colour from Block A, each about ten weeks deep and **generated relative to
today**, so the demo is always current. Each one shows off something different:

| Habit | Shows |
|---|---|
| Drink water | a 24-day streak, still going |
| Morning run | a Mon/Wed/Fri schedule, with rest days drawn as rest days |
| Read 20 pages | a 31-day run that ended weeks ago, so *Best run ever* differs from *Streak going* |
| Gym | three times a week, counted in weeks |
| Sleep by 11 | missed yesterday, because a believable record has misses |
| Meditate | started a month in, so its year shows blank days before it, not misses |

Plus three tasks, one of them done. Today is part-done, so there's something left to tick.

It is **the same every time** for a given day: a seeded random sequence, and a Fisher–Yates
shuffle rather than `sort(() => random() - 0.5)`, which is biased and would differ between
browsers.

---

## What this block found

### The sign-in clear alone would not have kept the sample out

Signing in dispatches "clear the sample" and starts the first sync in the same moment. But the
sync reads the device's state **before** that clear has been applied, so on its own the clear
would have let the whole sample upload on the very first sync. What actually keeps it out is
the sync stripping sample records from everything it sends. Mutation **C6** shows it: remove
the stripping, keep the clear, and V5C-31 goes red. The clear is what empties the device; the
stripping is what protects the account.

### A test that was right for the wrong reason, nearly

V5C-31 first failed with *your own* habit not uploading either. Probing showed the same on
Block B's code, which looked like a real v2 bug: opening the app signed in would skip anything
only on the device. It isn't. The test's fake account was signed in from the very first render,
and the real session never is: it starts as "loading" and Supabase reports it a moment later,
after the device has loaded. The tests now sign in after the app opens, which is also the real
"load the sample, then sign in" story.

### The record looked repetitive

The first sample put the same habit and number in both *Streak going* and *Best run ever*
(Drink water, 24 days). Real records usually have an older best. *Read 20 pages* now has a
31-day run that ended weeks ago, with a miss forced on each side (without them, neighbouring
ticks joined on and it came out at 39).

### The browser tests outgrew this laptop's memory

With other sessions open, 1.3 GB of 16 GB was free and the production build took 4m06s, past
Playwright's fixed four-minute limit for starting the app. The limit can now be raised with
`HABIBIT_E2E_SERVER_TIMEOUT`, as the port already can with `HABIBIT_E2E_PORT`. CI keeps the
default.

---

## Results

### The sample: `lib/sample.test.ts`

| # | Check | |
|---|---|---|
| V5C-01 | six habits, one per colour, and three tasks | ✅ |
| V5C-02 | **every id is a real UUID from the reserved block** | ✅ 🔴 |
| V5C-03 | it's a valid state, as storage would read it back | ✅ |
| V5C-04 | every look and schedule is one this build can draw and store | ✅ |
| V5C-05 | **nothing is dated after today; every habit has weeks of history** | ✅ 🔴 |
| V5C-06 | **the same day always gives the same sample** | ✅ |
| V5C-07 | it moves with the calendar | ✅ |
| V5C-08 | **the record reads as a person's**: a long streak, a fresh miss, a habit started later, a habit counted in weeks | ✅ |
| V5C-16 | **the best run ever is an older one, not the streak going now** | ✅ 🔴 |
| V5C-12/13 | **removing the sample leaves exactly what was yours**; with none there, the very same state | ✅ 🔴 |
| V5C-14 | deleted samples don't count as samples still here | ✅ 🔴 |
| V5C-15 | every kind of sync outbox entry for a sample is recognised, and nothing else is | ✅ |

### In the store and the sync: `store/sample.test.ts`, `store/sample-sync.test.tsx`

| # | Check | |
|---|---|---|
| V5C-20 | loading adds the sample beside what you already have | ✅ |
| V5C-21 | **loading twice gives one sample, not two** | ✅ 🔴 |
| V5C-22 | **clearing removes the sample and nothing else**, ticks included | ✅ 🔴 |
| V5C-24 | clearing with no sample there changes nothing | ✅ 🔴 |
| V5C-25 | neither loading nor clearing is ever queued for an account | ✅ |
| V5C-30 | **signing in clears the sample, and only the sample** | ✅ 🔴 |
| V5C-31 | **nothing from the sample is ever uploaded; your own habit is** | ✅ 🔴 |
| V5C-32 | **even a sample that appears while signed in uploads nothing and never waits in the outbox** | ✅ 🔴 |

### Screens: `Welcome.test.tsx`

| # | Check | |
|---|---|---|
| V5C-40 | the welcome offers the sample, in words | ✅ |
| V5C-41 | **signed in, the sample isn't offered at all** | ✅ 🔴 |
| V5C-42 | each starter adds exactly that habit | ✅ |
| V5C-44 | the faces only move for someone who hasn't asked for less motion | ✅ |
| V5C-45..47 | the banner is there while the sample is, says it's made up, **clears in one tap, and Undo restores it** | ✅ |

### Browser: `e2e/welcome.spec.ts`, Android and desktop

| # | Check | |
|---|---|---|
| V5C-60 | **a first visit opens on a welcome, not an empty list** | ✅ 🔴 |
| V5C-61 | **one tap fills Today and Progress (highlights, year grid), and it survives a reload** | ✅ |
| V5C-62 | clearing brings the welcome back; Undo undoes it | ✅ |
| V5C-63 | **clearing keeps a habit you added yourself** | ✅ |
| V5C-64 | a starter adds that habit, with a face | ✅ |
| V5C-65 | the welcome fits at 375px, every button at least 44px tall | ✅ |
| V5C-66 | **signing in clears the sample, and the account never holds any of it** | see below |
| V5C-67 | signed in, an empty app doesn't offer the sample | see below |

### The account checks, honestly

V5C-66 and V5C-67 sign in for real against a local Supabase. **They passed on both devices on
2026-10-07** with the same app code as now, and **V5C-66 passed on desktop again today** after
its wait for the first sync was brought in line with the other account specs. They have not had a
clean run on both devices today. With other sessions open, 1–2 GB of 16 GB was free, the local
auth service crashed (every request a 500), and `supabase stop/start` and `docker info` both hung.
Getting it back means restarting Docker Desktop, which would also stop any other project's
containers, so I didn't.

Whatever the state of the tests, **the database itself says no sample has ever reached an
account.** Queried directly after every run: no habit, task or completion with a sample id,
anywhere. The test accounts hold exactly `["My own habit"]`, or nothing when a run ended before
its first sync.

**One more thing found:** on a loaded machine the account part of the browser suite can *silently
skip*. Playwright finds Supabase by running `supabase status` with a 60-second limit, and when that
times out it treats Supabase as absent and builds the app without accounts. The run looks green
apart from a "skipped" count. It's the same probe as the database-suite flakiness already flagged
as separate work. Pass `HABIBIT_E2E_SUPABASE` explicitly to avoid it.

### Mutation checks

12 of 13 killed, none survived, 1 not runnable here. Every mutated file was checked byte-identical afterwards.

| # | Broke | Caught by |
|---|---|---|
| C1 | nothing recognised as a sample | V5C-12 |
| C2 | clearing nothing still makes a new state (a storage rewrite on every signed-in open) | V5C-24 |
| C3 | loading twice doubles the sample | V5C-21 |
| C4 | clearing removes your habits too | V5C-22 |
| C5 | signing in doesn't clear the sample | V5C-30 |
| C6 | **the sync carries the sample** (the clear kept) | V5C-31: the clear alone is not enough |
| C7 | a sample edit waits in the outbox for ever | V5C-32 |
| C8 | the sample offered while signed in | V5C-41 |
| C9 | deleted samples still count as here | V5C-14 |
| C10 | the older run without its misses (comes out 39 days, not 31) | V5C-16 |
| C11 | the sample ticks a day after today | V5C-05 |
| C12 | the welcome never offers the sample | V5C-60 (browser) |
| C13 | the sign-in panel doesn't warn about the sample | **not run**: needs local Supabase (V5C-66). CI runs V5C-66 itself |

---

## Optional check, yours if you want it

On your Android phone, after the deploy:

1. Open Habibit in a private tab. Does the welcome explain the app in one glance?
2. Tap **See it with sample habits**, then look at Progress. Does it look like a real person's
   couple of months?
3. Tap **Clear them** on the banner. You should be back at the welcome.

Not marked passed on your behalf.

## Still owed from v4, unchanged by this block

The production build for v4 still fails on Vercel, so the live site is still the 21 September
bundle and none of v4 or v5 is visible there. The build log names the missing setting.
