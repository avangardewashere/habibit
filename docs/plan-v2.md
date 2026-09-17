# Habibit v2: Accounts, Sync & Offline

**Goal:** the same habits on your phone and your desktop, and an app that still opens with no signal,
without ever losing a checkmark along the way.

## Decisions locked

| Decision | Choice |
|---|---|
| Backend | **Supabase**: Postgres, sign-in, and per-user access rules |
| Sign-in | **Email magic link**. No passwords |
| Account | **Optional**. Signed-out works exactly as today; signing in adds sync |
| Conflicts | **Latest change wins**, decided per habit, per task, per completion |
| Verification | **Automated tests replace manual QA.** Vitest stays for unit tests, Playwright added for browser flows |

## How a block is signed off now

Each block still ends with a doc in `docs/qa/` and a **stop**. The rows are now tests rather than taps:

| ID | What it proves | Test | Result |
|---|---|---|---|
| V2A-07 | Reload keeps data | `e2e/persistence.spec.ts` › "survives reload" | ✅ |

Two rules carry over from v1:

- **A test only counts if it goes red with the fix removed.** Every new guard gets checked that way.
- **Nothing is marked passed on your behalf.** A few things can't be automated, such as a real email
  arriving or installing on your Android phone. They go in a short *optional checks* list at the end.

---

## Block A: Test safety net

*No app changes. This block builds the tool that replaces your manual sign-off.*

- Add **Playwright**, run against a production build (`next build && next start`), with a phone-sized
  viewport as the default.
- Rewrite the most valuable v0–v1 manual rows as browser tests:
  - data survives a reload (the v0.5 wipe bug)
  - tapping a row while its `⋯` menu is open doesn't tick it (the cancel-delete bug's descendant)
  - **tapping away saves a rename**. This is v1 row B-15, the one the old browser pane couldn't
    exercise with real focus
  - **midnight rollover keeps a streak**, using Playwright's fake clock instead of changing your OS clock
  - dark mode has its theme set before first paint (no white flash)
  - the status-bar colour follows the three theme options
  - no sideways scroll at 375px; 7-day strip dots measure at least 44px
  - the manifest and icons are served correctly
- **GitHub Actions** runs typecheck, lint, Vitest and Playwright on every push. A red run is visible on GitHub.
- New scripts: `npm run e2e` and `npm run check` (everything at once).

**Done when:** CI is green and each ported test has been shown to fail with its original fix reverted.

---

## Block B: Sync-ready data

*Local only. No backend and no visible change. This block gets the data into the right shape for sync.*

Sync needs to know two things the app doesn't record today: **when** each thing last changed, and
**what was deleted**. A deleted habit currently just vanishes, so another device can't find out it's gone.

- Every habit, task and completion gains `updatedAt`.
- Deletes become **tombstones**: `deletedAt` is set, and every selector hides the row.
- Completions change from "the key exists" to a record with `done: true | false`. Unticking becomes a change that can sync.
- **Storage schema v1 → v2** through the existing `migrate()` function. Old data upgrades; nothing is dropped.
- **Decide `emoji` and `archivedAt`** before they become database columns. **Decided in Block B:** drop `emoji`
  (never used), keep `archivedAt` (costs nothing, and archiving is a likely feature).
- The reducer takes the current time as an input instead of reading the clock, so tests stay deterministic.

**Done when:** migration tests load real v1 data (including the corrupt-data cases) with nothing lost,
all 145 existing tests plus Block A's browser tests still pass, and the tombstone behaviour is unit-tested.

---

## Block C: Accounts

*Sign in and out. No syncing yet.*

**You'll need to do first** (I can't create accounts for you): create a Supabase account and project,
then add its URL and public key to Vercel and to a local `.env.local`. I'll give you the exact steps.

- Tables `habits`, `tasks` and `completions`, mirroring `lib/types.ts`, with a `user_id` on each.
- **Row Level Security** on every table: a user can read and write only their own rows.
- Magic-link sign-in with `@supabase/ssr`. The link lands on an auth callback route, then back to the app.
- A small account entry in the header, reusing the `⋯` pattern: *Sign in* or *your email · Sign out*.
- Signed out, the app is unchanged. That's a test in its own right.

**Two things to know now:**
- **Supabase's built-in email sender is meant for testing** and is heavily rate-limited. Real users
  will need a proper email provider (for example Resend) before launch. I'll check the current limits then.
- **Free projects pause after a period of inactivity.** Fine for learning, worth knowing before real users arrive.

**Tests:** migrations applied to a local Supabase in CI (which uses Docker). An **access test proves user A
can't read or write user B's rows**. Browser tests catch the magic-link email in Supabase's local mail
catcher, so sign-in is tested end to end without a real inbox.

**Optional check:** a real magic link arriving in your Gmail and opening on your Android phone.

---

## Block D: ⚠️ First sign-in

*The biggest risk in v2, so it gets a block to itself.*

Ids are already random UUIDs (`lib/id.ts`), so a device's habits and an account's habits can't collide.
That makes the first sign-in a **merge, never a replace**:

1. Pull everything the account already has.
2. Merge it with the device's data, record by record, keeping the latest change.
3. Push the result up. Only write locally once the server has confirmed.

Every case gets a test:

| Device | Account | Must end with |
|---|---|---|
| Empty | Has data | The account's data |
| Has data | Empty (**the classic data-wipe case**) | The device's data, now also on the server |
| Has data | Has data | Both. Duplicate-looking habits are allowed, lost ones are not |
| Has data | Sign-in fails partway | The device's data untouched, and retrying works |

**Sign-out behaviour** (recommended default, tell me if you disagree): sign-out warns if any changes
haven't synced yet, then clears the account's data from the device, so a shared computer doesn't leak it.

**Done when:** every row above passes against both a fake server and the local Supabase.

**Decided in Block D:** sign-out clears the device (warning first if unsynced); same-named habits are kept
separately; sync runs at sign-in, on every app open, and on returning to the foreground. Report:
`docs/qa/v2-d-first-sign-in.md`.

---

## Block E: Sync between devices

- A **sync engine** in `lib/` with no React, testable against an in-memory fake server:
  - **Push:** local changes go into an outbox, which sends them and clears only after the server confirms.
  - **Pull:** fetch rows changed since the last pull, tracked by a server-side timestamp, and merge.
- **Latest change wins** per record, using each record's `updatedAt`.
- Syncs on sign-in, when the app regains focus, and shortly after each change.
- A quiet sync status: nothing when synced, a small indicator when changes are waiting, an error with retry.

**Known limit:** "latest" is judged by device clocks. If a phone's clock is minutes off, its edits can
win or lose unexpectedly. That's acceptable for one person's own devices; it's recorded, not hidden.

**Tests:** two simulated devices, covering edit/edit, edit/delete, rename on both, a completion ticked
on one and unticked on the other, and the same change delivered twice (must be harmless).

**Decided in Block E:** open devices check every 30 s while visible and on switching back; a dot on the
account button shows waiting or failing sync. Report: `docs/qa/v2-e-live-sync.md`.

---

## Block F: Offline

- A **service worker** so the app shell opens with no connection. Before choosing a tool, I'll read
  `node_modules/next/dist/docs` first. Serwist was the early suggestion, but it has to work with
  Next 16's build, so that gets checked before it's assumed.
- Changes made offline wait in the Block E outbox and send when the connection returns.
- The sync status shows *offline* clearly, and the app stays fully usable.
- The service worker also sets up v3's reminders (web push).

**Tests:** Playwright switches the network off, reloads (the app must still open), makes changes,
switches it back on, and checks everything reached the server.

**Optional check:** airplane mode on your installed Android app.

---

## Not in v2

Reminders and weekly review (v3), reordering, archiving UI, undo, sharing habits with other people,
account deletion UI (needed before a public launch, so it's worth adding at the end of v2 or early v3),
and the theme popup (still in `docs/backlog.md`).
