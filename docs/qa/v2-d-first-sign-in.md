# Habibit: v2 Block D, the first sign-in

**Block:** D of 6 (v2) · **Date:** 2026-09-18 · **Status:** ✅ all green on CI, waiting for your sign-off

> **Signing in now combines this device with your account, and never replaces one with the other.**
> A full phone signing into an empty account uploads everything. An empty laptop signing into that
> account downloads everything. Two devices with different habits both end up with all of them.
> Signing out clears the device, after making sure the account has everything.

**Legend:** ✅ pass · 🔴 **proven**: shown to fail when the guard was deliberately broken

---

## Your decisions

| Question | Your choice |
|---|---|
| What sign-out does to the device | **Clear it**, warning first if anything hasn't reached the account |
| Two habits with the same name, made separately | **Keep both.** Never merge histories that might not belong together |
| When to combine before Block E | **At sign-in, every time the app opens, and when it comes back to the foreground** |

---

## How it works

```
device data ─┐
             ├─► merge (latest change wins, per record) ─► upload what the account lacks ─► apply to device
account data ┘                                                        │
                                                        fails? ───────┴─► device untouched, "try again"
```

1. **Merge is per record.** Each habit, task and tick is decided on its own by `updatedAt`. A record only
   one side has is always kept. That single rule is what makes the empty-account wipe impossible.
2. **Ties go to deletes**, so two edits at the same instant can never bring a deleted habit back.
3. **The device only changes after the upload succeeds.** If anything fails, nothing on the device changes.
4. **The merge result is combined into the device's *current* data**, not swapped in. An edit you make
   while a sync is running survives.
5. **The database also enforces "latest wins"** (new migration). If a slow device uploads an older version
   of a row after another device saved a newer one, the database keeps the newer one.

---

## 1. The merge: `lib/sync/merge.test.ts`

| ID | What it proves | Result |
|---|---|:---:|
| V2D-01 | Empty device + account with data → the account's data | ✅ |
| V2D-02 | ⭐ Device with data + **empty account** → the device's data, nothing wiped | ✅ 🔴 |
| V2D-03 | Both have data → everything from both | ✅ 🔴 |
| V2D-04 | Same-named habits made separately are both kept | ✅ 🔴 |
| V2D-05 | A newer rename beats an older one, on either side | ✅ 🔴 |
| V2D-06/07 | A newer delete beats an older edit, and a newer edit beats an older delete | ✅ |
| V2D-08 | At exactly the same instant, the delete wins | ✅ 🔴 |
| V2D-09 | A later untick beats an earlier tick | ✅ |
| V2D-10 | Decisions are per record: one habit from each side | ✅ 🔴 |
| V2D-11 | The order of the two sides doesn't matter | ✅ 🔴 |
| V2D-12 | Merging the result again changes nothing | ✅ 🔴 |
| V2D-13/14 | Only what the account lacks or has older is uploaded; nothing when they match | ✅ |

## 2. One sync round: `lib/sync/sync.test.ts` (in-memory account)

| ID | What it proves | Result |
|---|---|:---:|
| V2D-20 | Empty device receives the account's data | ✅ |
| V2D-21 | ⭐ Full device + empty account → everything uploaded, device keeps it | ✅ 🔴 |
| V2D-22 | Both have data → both end up with everything | ✅ 🔴 |
| V2D-23 | ⭐ Connection drops before reading → nothing to apply, nothing uploaded | ✅ |
| V2D-24 | ⭐ Connection drops **halfway through uploading** → reports failure; retrying finishes the job | ✅ 🔴 |
| V2D-25 | Syncing again straight away uploads nothing | ✅ 🔴 |
| V2D-26/27 | Records survive the round trip through the database's shape and time format | ✅ |

## 3. The app's sync behaviour: `store/SyncProvider.test.tsx`

| ID | What it proves | Result |
|---|---|:---:|
| V2D-30 | Signing in brings the account's habits onto the device, after the upload | ✅ |
| V2D-31 | ⭐ An edit made **while a sync is running** isn't lost when it lands | ✅ 🔴 |
| V2D-32 | ⭐ A failed sync changes nothing on the device and says so | ✅ |
| V2D-33 | ⭐ A sync still running when you sign out **doesn't pour your data back** onto the cleared device | ✅ 🔴 |
| V2D-34 | ⭐ Sign-out **refuses to clear** the device if the account couldn't be reached | ✅ 🔴 |
| V2D-35 | Sign-out after a good sync clears the device, and the empty state is saved | ✅ |

## 4. Against the real database: `supabase/tests/sync.test.ts`

| ID | What it proves | Result |
|---|---|:---:|
| V2D-40 | ⭐ A full device uploads, and reads back identically: tombstones, unticks, time formats | ✅ |
| V2D-41 | A second device on the same account receives everything | ✅ |
| V2D-42 | Syncing an unchanged device again uploads nothing | ✅ |
| V2D-43 | ⭐ **An older version arriving late never overwrites a newer one** | ✅ 🔴 |
| V2D-44 | …the same for ticks | ✅ 🔴 |
| V2D-45 | One stale row doesn't block the rest of an upload | ✅ 🔴 |
| V2D-46 | ⭐ More than 1,000 ticks are all read back | ✅ |

## 5. End to end: `e2e/sync.spec.ts` (two browsers as two devices, on CI)

| ID | What it proves | Result |
|---|---|:---:|
| V2D-50 | ⭐ Habits already on the device survive signing in, and reach the account | ✅ |
| V2D-51 | An empty device signing in gets the account's habits | ✅ |
| V2D-52 | Both have habits → both kept, including two "Drink water"s | ✅ |
| V2D-53 | ⭐ A second device signing in gets the first device's habits **and ticks** | ✅ |
| V2D-54 | Adding on one device and deleting on the other both arrive when each app opens | ✅ |
| V2D-55 | ⭐ Sign-out clears the device (even after a reload); signing back in restores everything | ✅ |
| V2D-56 | Cancelling sign-out keeps everything | ✅ |
| V2D-57 | ⭐ Account unreachable at sign-in → device untouched, message shown, **Try again** uploads | ✅ |
| V2D-58 | ⭐ Signing out while unreachable warns first; **Stay signed in** keeps everything | ✅ |

Block C's sign-out tests (V2C-28, 30) now use the confirm step. **V2C-29 changed meaning:** it used to
check that signing in left the stored bytes untouched, which is no longer true by design. It now checks
that signing in never removes or changes the habits you have.

---

## 6. Proving the tests work

| Guard broken on purpose | Tests that failed |
|---|---|
| The account's copy **replaces** the device's instead of merging | **14** |
| Ties no longer go to deletes | 1 (V2D-08) |
| The device updated even when the upload failed | 1 (V2D-24) |
| Sync result **swapped in** instead of merged into current data | 1 (V2D-31) |
| A sync finishing after sign-out still applied | 1 (V2D-33) |
| Sign-out clears the device even when the account is unreachable | 1 (V2D-34) |
| **The database trigger missing** | 3 (V2D-43, 44, 45) |

The trigger result came for free: the first local run happened before the new migration was applied,
and exactly those three tests failed. After `supabase migration up`, all passed.

**Not proven this way:** the 9 browser tests in section 5. Your computer didn't have the memory to run
browser builds locally, so they ran on GitHub CI, where breaking guards one at a time would mean a CI run
per guard. The guards they exercise are the same ones proven by the unit and database tests above.

---

## 7. Found along the way

| What | Cause | Outcome |
|---|---|---|
| Local Supabase tried to download a different Postgres | Linking your project pinned its version (17.6.1.166) in `supabase/.temp` | Good: local tests now run on the same Postgres as production. First download hit a rate limit; retry worked |
| **V2D-56 failed on CI** | Test mistake: "Cancel" also matched the account button, whose label contains the test email `habibit-cancel-…` | Exact match |
| **V2D-57 failed on CI** | Test mistake: the Supabase library **retries a failed read three times (1s, 2s, 4s)** before reporting it. The test waited 5s | Waits 20s. The retries are worth keeping: they ride out brief phone-signal blips |
| Unit tests couldn't start locally | ~0.4–1 GB of memory free with Docker and several dev servers running | Ran with one worker, Supabase stopped for unit tests |

---

## 8. Known limits (until Block E)

| Limit | Impact |
|---|---|
| **Changes sync when the app opens or returns to the foreground**, not the moment you make them | A tick on your phone shows on your PC the next time the PC's Habibit opens or regains focus (at most once a minute) |
| "Latest" is judged by each device's clock | A phone whose clock is minutes off can win or lose a same-record conflict unexpectedly |
| Deleted rows (tombstones) are never cleaned up | A few hundred bytes each |
| If a session **expires** on its own (not via Sign out), the device isn't cleared | Signing into a *different* account afterwards would merge this device's habits into it |

---

## 9. Your steps

**Apply the new migration to the hosted project** (the database trigger):

```bash
npx supabase db push
```

Then try it on `localhost:3002` with two browsers (for example Chrome and a Chrome Incognito window) as two
"devices", signed in with your email:

1. Add a habit in one, then reload the other. It appears.
2. Tick it in the second, reload the first. The tick appears.
3. Sign out in one. That browser empties; the other keeps everything.
