# Habibit: v2 Block E, live sync between devices

**Block:** E of 6 (v2) · **Date:** 2026-09-18 · **Status:** ✅ all green on CI, waiting for your sign-off

> **Two open devices now stay in step without reloading.** Tick a habit on your phone and it reaches your
> account about a second and a half later; your PC, if Habibit is open and visible, shows it within 30
> seconds, or the moment you switch back to it.

**Legend:** ✅ pass · 🔴 **proven**: shown to fail when the guard was deliberately broken

---

## Your decisions

| Question | Your choice |
|---|---|
| How fresh an open device should be | **Within ~30 seconds**, checking only while visible, plus straight away on switching back |
| How to show sync status | **A small dot on the account button**: nothing when synced, a quiet dot while edits wait, a warning dot while syncing fails |

---

## How it works

| When | What happens |
|---|---|
| **Opening the app / signing in** | Block D's full combine, unchanged. It's the safety net: anything a closed tab never uploaded gets caught here |
| **You make an edit** | The record's name goes in an **outbox**. About 1.5 s after the *last* edit, the outbox uploads, so several quick ticks go up together |
| **Every 30 s while visible, and on switching back** | A small sync: upload the outbox, then download **only rows changed since the last one** |

**"Changed since" uses the database's clock, never a device's.** A new migration stamps every row with the
server time of its last write. A phone with a wrong clock can't hide its changes from other devices.

**Two details that matter:**
- **An outbox entry is only cleared if what was sent is still the latest version.** An edit made while an
  upload is on its way stays in the outbox and goes up straight after.
- **Each small sync re-reads the last two minutes before its cursor.** A write can commit a moment after a
  faster one that was stamped later. Without the overlap, that write would be skipped forever. Re-reading is
  harmless, because merging is safe to repeat.

---

## 1. The sync engine: `lib/sync/incremental.test.ts` (two devices, one fake account)

The fake account behaves like the real database where it matters: it keeps the newest version of a row,
and stamps its own server time.

| ID | What it proves | Result |
|---|---|:---:|
| V2E-01 | Every kind of edit names the record it changed | ✅ 🔴 |
| V2E-02 | Data arriving by sync is never counted as an edit, so it isn't sent straight back | ✅ |
| V2E-03 | A successful sync empties the outbox | ✅ |
| V2E-04 | ⭐ A failed sync keeps the outbox, and the next one delivers it | ✅ |
| V2E-10 | An edit on one device reaches the other on its next small sync | ✅ |
| V2E-11 | ⭐ **Both rename the same habit** → the later rename wins on both, even if it uploads first | ✅ |
| V2E-12 | ⭐ **One edits, the other deletes later** → deleted on both | ✅ |
| V2E-13 | …a delete followed by a later edit elsewhere keeps the edit | ✅ |
| V2E-14 | ⭐ **Ticked on the phone, unticked later on the PC** → unticked on both | ✅ |
| V2E-15 | ⭐ **The same change delivered twice** does no harm | ✅ |
| V2E-16 | ⭐ A small sync downloads only what changed: 2 rows, never the 50 older habits | ✅ 🔴 |
| V2E-17 | ⭐ A write that commits late, stamped before the cursor, is still picked up | ✅ 🔴 |
| V2E-18 | An edit made after a sync started stays in the outbox | ✅ 🔴 |
| V2E-19 | With no cursor yet, a small sync does the full combine | ✅ |

## 2. In the app: `store/SyncProvider.live.test.tsx` (fake timers, so "30 s" is exact)

| ID | What it proves | Result |
|---|---|:---:|
| V2E-30 | ⭐ An edit reaches the account **~1.5 s** after it's made, not before, with no reload | ✅ 🔴 |
| V2E-31 | Three quick edits go up in **one** upload | ✅ 🔴 |
| V2E-32 | ⭐ Another device's change appears at **30 s**, not at 29 | ✅ |
| V2E-33 | No checking while hidden; switching back checks straight away | ✅ 🔴 |
| V2E-34 | ⭐ Offline: edits stay on the device with a waiting count and an error, then go up once it's back | ✅ 🔴 |
| V2E-35 | ⭐ An edit made **while an upload is on its way** is not lost: it goes up right after | ✅ 🔴 |

## 3. Against the real database: `supabase/tests/sync.test.ts`

| ID | What it proves | Result |
|---|---|:---:|
| V2E-40 | ⭐ "Changes since" returns only rows written after the last pull | ✅ 🔴 |
| V2E-41 | An edit counts as a change: the edited row comes back | ✅ |
| V2E-42 | ⭐ **A stale upload the database refuses is not reported as a change** | ✅ 🔴 |
| V2E-43 | Ticks and tasks are tracked the same way | ✅ 🔴 |

## 4. End to end: `e2e/live-sync.spec.ts` (on CI)

| ID | What it proves | Result |
|---|---|:---:|
| V2E-50 | ⭐ An edit reaches the account within seconds, with no reload | ✅ |
| V2E-51 | ⭐ **Both devices open:** the PC shows the phone's edit when its 30-second check comes round | ✅ |
| V2E-52 | Switching back to the app pulls in a tick straight away | ✅ |
| V2E-53 | ⭐ The **dot** appears while an edit can't upload, and clears once it does; the button's label says the same | ✅ |
| V2E-54 | The popup says how many changes are waiting | ✅ |

CI ran the whole suite **twice** (the second run a deliberate re-run to catch flaky timing): 146 / 146 browser test runs both times. All Block A–D tests still pass. Block D's browser helpers moved to `e2e/account-helpers.ts`, shared with these.

---

## 5. Found along the way

### ⭐ A real bug, caught by the database tests

**The cursor lost microseconds.** Postgres stores times like `…:03.123456`; my code converted the cursor to
a JavaScript date, which keeps only `…:03.123`. Asking for rows "after 03.123" returned the row from
`03.123456` again, every time. V2E-40, 42 and 43 failed. The fix: keep the database's own time text as the
cursor, exactly as written. Those three tests are the 🔴 proof.

### ⭐ A safety step that was hiding two bugs

I first built a "repair" step: after downloading, re-upload anything the account sent back older than
this device's copy. When I broke guards on purpose, three changes went **uncaught**:

| Broken on purpose | Why nothing failed |
|---|---|
| Removing the repair step itself | In a normal session every local change is already in the outbox, so the step never did anything |
| Clearing the **whole** outbox after a sync | The repair step quietly re-sent the newest version |
| Not re-syncing when edits are still waiting | Same |

So the repair step was removed (less code, nothing to mask bugs), and V2E-35 was corrected: its second edit's
1.5-second timer now fires *while* the first upload is still stuck, which is the real-world order. Both bugs
are now caught.

### Test mistakes

| Test | Mistake |
|---|---|
| V2E-16 | Assumed older rows would never be re-read, but the 2-minute overlap is measured from the newest row seen, not from "now". The test now lets older rows age out of that window before checking |
| V2E-51 | Signed the phone in a second time just to look up the account id, which reloads the page it was testing. Caught before running |

### A small UI improvement found by a test

While syncing was failing, the popup showed only the error and hid how many changes were waiting. It now
shows both.

---

## 6. Proving the tests work

| Guard broken on purpose | Tests that failed |
|---|---|
| Renames not added to the outbox | 3 (V2E-01, 18, 35) |
| No 2-minute overlap | 2 (V2E-16, 17) |
| Every sync downloads the whole account | 1 (V2E-16) |
| Clearing the whole outbox after a sync | 1 (V2E-35) |
| Not re-syncing when edits are still waiting | 1 (V2E-35) |
| Checking every 30 s even while hidden | 1 (V2E-33) |
| Uploading on every single edit, no gathering | 4 (V2E-30, 31, and two sign-out tests) |
| A failed sync clears the outbox | 1 (V2E-34) |
| The cursor rounded to milliseconds | 3 (V2E-40, 42, 43) |

**Not proven this way:** the 5 browser tests in section 4. Your computer can't run browser builds locally,
and breaking guards one CI run at a time wasn't worth it when the unit and database tests above cover the
same guards.

---

## 7. Known limits

| Limit | Impact |
|---|---|
| **Changes arrive within ~30 s**, not instantly | By your choice. Supabase Realtime could make it instant later |
| A hidden tab doesn't check | A phone with Habibit in the background catches up the moment it's opened |
| "Latest" is still judged by each device's clock | The *cursor* uses the server's clock, but which edit wins still uses `updatedAt`. A phone whose clock is minutes off can still win or lose a conflict unexpectedly |
| Deleted rows are never cleaned up | A few hundred bytes each. Clearing them safely needs every device to have seen the delete, which nothing tracks yet |
| Offline edits wait **in memory** until the next sync or app open | Closing the tab while offline loses the outbox, **not the data**: the edits are saved on the device, and the next app open's full combine uploads them. Block F makes offline a first-class case |

---

## 8. Your steps

Apply the new migration to the hosted project:

```bash
npx supabase db push
```

Then, on `localhost:3002`, with two windows signed in to your email and **both left open and visible**:

1. Add a habit in one. Within about 30 seconds it appears in the other, with no reload.
2. Turn off your Wi-Fi and tick something. After a few seconds a small dot appears on the account button.
   Turn Wi-Fi back on: the dot goes away within 30 seconds.
