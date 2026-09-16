# Habibit: v2 Block B, sync-ready data

**Block:** B of 6 (v2) · **Date:** 2026-09-17 · **Status:** ✅ all green, waiting for your sign-off

> **Nothing looks different, and that's the point.** Your data is now stored in a shape another device
> can sync with. Every record knows when it last changed, deletes leave a marker behind instead of a
> gap, and existing v1 data upgrades itself the first time the new version opens.

**Legend:** ✅ pass · 🔴 **proven**: shown to fail when the guard was deliberately broken

---

## Why this block exists

Sync needs to answer two questions that v1 data can't:

| Question | v1 | v2 |
|---|---|---|
| *My phone and my laptop both changed this habit. Which change is newer?* | Unknowable: no edit times | Every habit, task and tick has `updatedAt` |
| *This habit is on my laptop but not my phone. Was it deleted, or just never synced?* | Unknowable: deleted rows vanished | A deleted row stays as a **tombstone** with `deletedAt` |
| *I unticked yesterday on my phone. How does my laptop find out?* | It can't: unticking erased the record | Unticking stores `done: false` |

---

## How to run it

```bash
npm run check
```

| | Before | Now |
|---|---:|---:|
| Unit tests | 145 | **180** |
| Browser tests | 37 (74 runs) | **44 (88 runs)** |

---

## 1. Decisions made in this block

| Decision | Choice | Why |
|---|---|---|
| `emoji` field | **Dropped** | Never settable from the UI since v0, so every stored value was `null`. Better gone than a database column nobody fills |
| `archivedAt` field | **Kept** | Costs nothing, the selectors already honour it, and archiving is a likely feature |
| Where the time and new ids come from | **Outside the reducer** | See section 3 |
| A deleted habit's past ticks | **Kept, hidden** | Another device may still need them. Clearing tombstones for good waits until sync can confirm the server has them |

---

## 2. The upgrade from v1

Tested against **real data captured from the live v1.0.0 app** (`lib/fixtures/storage-v1.json`), not
something written by hand. Before capturing, I used the live app the way a person would: added habits
and tasks, filled in a four-day streak, ticked and unticked a day, renamed a habit, and deleted a habit
and a task.

| ID | What it proves | Test | Result |
|---|---|---|:---:|
| V2B-01 | ⭐ A returning user sees every habit, tick, streak and task **exactly as before** | browser | ✅ 🔴 |
| V2B-02 | ⭐ **Just opening the app writes nothing.** The original v1 bytes stay on disk until the first edit | browser + unit | ✅ 🔴 |
| V2B-03 | Their first change saves everything as version 2, and all of it survives a reload | browser + unit | ✅ 🔴 |
| V2B-08 | Every v1 tick becomes `done: true`, dated when it was ticked | unit | ✅ |
| V2B-09 | Each row's `updatedAt` is the latest time v1 knew about | unit | ✅ |
| V2B-10 | Corrupt v1 data is quarantined, not upgraded | unit | ✅ |
| V2B-11 | Data from a *newer* version (3) is refused, not guessed at | unit | ✅ |
| V2B-12 | The upgrade works under StrictMode, where the v0.5 reload wipe happened | unit | ✅ |

**Why V2B-02 has a star.** If the upgrade ever had a bug that lost data, the untouched original is still
there to recover. It gets replaced only when you actually change something, and by then you've seen the
upgraded data on screen.

---

## 3. What's stored now

| ID | What it proves | Test | Result |
|---|---|---|:---:|
| V2B-04 | Deleting a habit leaves a hidden tombstone, not a gap | browser + unit | ✅ 🔴 |
| V2B-05 | Deleting a task leaves a hidden tombstone | browser + unit | ✅ 🔴 |
| V2B-06 | Unticking is stored as `done: false` | browser + unit | ✅ 🔴 |
| V2B-07 | Every change moves `updatedAt` forward; `createdAt` never changes | browser + unit | ✅ 🔴 |
| V2B-13 | A deleted habit or task can't be renamed, ticked or deleted again | unit | ✅ |
| V2B-14 | A deleted habit's ticks don't count toward today's `2/3` | unit | ✅ 🔴 |
| V2B-15 | `done: false` breaks a streak exactly like a missing day | unit | ✅ 🔴 |
| V2B-16 | ⭐ **The reducer is deterministic:** same state + same action = same result | unit | ✅ 🔴 |
| V2B-17 | Stored data with a missing `updatedAt`, a v1-style tick, or a non-boolean `done` is rejected | unit | ✅ 🔴 |
| V2B-18 | Everything from Block A still passes: all 37 V2A tests | browser | ✅ |

### Why V2B-16 matters

Before this block the reducer read the clock and made new ids itself. That meant the same action could
produce a different result each time it ran. Now the **provider** stamps each action with the time (and a
new id, for adds) *before* the reducer sees it:

```
UI: "add Drink water"  →  stamp: + id, + time  →  reducer (pure)  →  new state
```

This matters for Block E. The sync outbox will store actions and may retry or replay them, and a replayed
action has to produce the same result it did the first time.

---

## 4. Proving the tests work

The same method as Block A. I broke each guard on purpose, then checked that tests failed.

| Guard broken | Unit tests failing | Browser test failing |
|---|---:|---|
| The v1 upgrade removed | 10 | V2B-01, 02, 03 |
| Deleting removes the habit instead of leaving a tombstone | 1 | V2B-04 |
| Unticking erases the record (the v1 behaviour) | 1 | V2B-06 |
| Deleted habits no longer hidden | 2 | V2B-04 |
| Deleted tasks no longer hidden | 2 | V2B-05 |
| A rename forgets to update `updatedAt` | 2 | V2B-07 |
| Loading writes the upgraded data straight back | 1 | V2B-02 |
| The reducer makes its own ids again | 15 | — (unit is the right layer) |
| "Done" means "a record exists", ignoring `done: false` | 3 | V2B-06 |
| The validator accepts v1-style ticks in v2 data | 1 | — (unit is the right layer) |

**10 of 10 caught.** Every browser test in `e2e/data.spec.ts` failed for at least one broken guard. The new
browser tests also ran 5× in a row, and all 70 runs passed.

---

## 5. Known limits, written down rather than hidden

| Limit | Impact | When it's addressed |
|---|---|---|
| **Tombstones are never cleared yet** | Deleted rows stay in storage. A few hundred bytes each, so nothing close to the storage limit | Block E, once the server confirms it has them |
| **v1 had no edit times** | A rename or untick made *before* this upgrade is dated from when the row was created. Only matters if two devices conflict over that one old edit | Can't be recovered; the data never existed |
| **An old tab left open across the update** | A tab still running v1 code reads v2 data as "unknown". It keeps a copy in quarantine and ignores it. If you then *edit in that old tab*, it saves v1 data, and edits made meanwhile in a new tab are lost. Reloading the old tab fixes it | Rare. Service-worker updates in Block F can prompt a reload |

---

## 6. What changed

| File | Change |
|---|---|
| `lib/types.ts` | `updatedAt` and `deletedAt` on habits and tasks; `Completion = { done, updatedAt }`; `emoji` removed |
| `lib/storage.ts` | Schema version 2; v2 validators; frozen v1 validator; `migrateV1()` |
| `store/reducer.ts` | `HabibitIntent` (what the UI asks) vs `HabibitAction` (stamped); `stamp()`; tombstones; untick keeps the record |
| `store/selectors.ts` | `liveTasks()`; every list hides tombstones; `isCompleted` reads `done` |
| `store/HabibitProvider.tsx` | `dispatch` stamps intents before the reducer |
| `lib/fixtures/storage-v1.json` | Real v1 data from the live app |
| `e2e/data.spec.ts` | 7 new browser tests |
| `e2e/helpers.ts` | Seeds v2 data; `seedRaw()` for exact bytes |

**No component changed.** `HabitSection` and `TaskSection` still dispatch exactly the same intents as
before. That's the payoff of the reducer and selectors sitting between the UI and the data.

### Deviations from the plan

| Plan said | Actually | Why |
|---|---|---|
| "Migration tests load real v1 data" | Captured **from the live production app** | Stronger than hand-writing a fixture that matches what I *think* v1 wrote |
| — | Added the rule that loading writes nothing until the first edit | Keeps the original recoverable if the upgrade is ever wrong |
| — | Deleted items refuse every further action | Otherwise a stray tick could bring a deleted habit's data back into play once sync exists |
