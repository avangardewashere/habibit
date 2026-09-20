# Habibit: v3 Block B, your own order and archiving

**Block:** B of 7 (v3) · **Date:** 2026-09-20 · **Status:** ✅ all green on CI, waiting for your sign-off

> **Habits sit where you put them, and one you're done with can step aside without taking its
> history with it.** Tap **Arrange** to drag habits into order, or nudge them with ↑ / ↓. Archive a
> habit from its `⋯` menu; it waits under "Archived", streak intact, until you bring it back.

**Legend:** ✅ pass · 🔴 **proven**: shown to fail when the guard was deliberately broken

---

## Your decision

| Question | Your choice |
|---|---|
| How reordering works on a phone | **An "Arrange" mode.** A button by the section title turns the list into handles and ↑ / ↓; ticking pauses until you tap Done |

Why it was worth asking: the `⋯` menu opens **inline**, as pills beside the title, and there isn't
room there for Move up and Move down as well as Rename, Archive and Delete. An always-visible drag
handle was the alternative, and it would have cost every row about 44px of title space and let a
scrolling thumb pick up a habit by mistake.

---

## What I read first, and what it changed

The plan said to check the drag library before writing anything.

- **`@dnd-kit/core` 6.3.1** (with `@dnd-kit/sortable`): accepts React 19, handles touch, mouse and
  keyboard, and announces moves to screen readers. Last published in 2024, but stable and widely
  used. **Chosen.**
- **`@dnd-kit/react` 0.5.0**: the newer successor, still pre-1.0. Not chosen — the app doesn't need
  what it adds, and a pre-1.0 dependency in a launch version isn't a trade worth making.

Keyboard users ended up covered by our own arrow-key handling on the handle **and** by the ↑ / ↓
buttons, so the plan's "menu fallback" wasn't needed. The library's keyboard mode was tried first
and dropped — see what CI found, below.

---

## How habit order is stored

Each habit gets a **`position`**: a short piece of text, sorted as text, with the property that a
new key can always be made *between* any two existing ones (`lib/order.ts`, about 40 lines, with a
property test behind it).

**Why not 1, 2, 3.** Moving the last habit to the top would renumber every habit. Two devices
reordering at the same time would each renumber everything, and "latest change wins" — which is
decided per habit — would stitch the two numberings into an order neither device chose. With keys,
a move writes **one** habit's row, so combining two devices' moves keeps both (V3B-11, V3B-17).

The whole list is given fresh keys only in three cases, and each is tested: habits made before v3
(they have no key), two habits that ended up sharing a key, and a key that has grown too long after
many moves into the same gap.

**Two things worth knowing:**

- **No new storage version.** The field was added as an optional one. Bumping the version number
  would make a tab still running the previous build treat your data as corrupt, because unknown
  versions are refused. An older build simply ignores the extra field (V3B-19).
- **The database column is nullable**, and an upload from an older build that leaves it out doesn't
  touch the position already stored (V3B-41).

---

## What's new on screen

- **Arrange / Done** beside the "2/3" count, shown only with two or more habits.
- In arrange mode each row has a **drag handle** and **↑ / ↓**. Ticking and the day strips are put
  away, and adding a habit waits until you're done, so the list can't change while you arrange it.
- **Archive** in each habit's `⋯` menu, between Rename and Delete.
- **"Archived (2)"** under the card opens the list, each with **Unarchive**. It disappears when
  nothing is archived.
- Deleting is unchanged: still two taps, still the only way to lose history.

Checked in the browser pane at 375px, in dark mode: ↑ moved a habit and kept focus on the button
(so pressing it again keeps going), a mouse drag moved one to the top, the three menu pills fit
inside the card with a long title, and the order survived a reload. The saved keys confirmed it:
after two moves, only the moved habits' keys had changed.

---

## Tests

| ID | What it proves | Test | Result |
|---|---|---|---|
| V3B-01…08 | Order keys: a key always fits between two others, 5,000 random inserts and 10,000 random key pairs never break the order, keys sort the same on every device | `lib/order.test.ts` | ✅ 🔴 |
| V3B-10 | New habits go at the end, each with a key | `store/reorder.test.ts` | ✅ 🔴 |
| V3B-11 | ⭐ Moving a habit rewrites **only that habit** | same | ✅ 🔴 |
| V3B-12 | Habits from before v3 keep their order until the first move | same | ✅ 🔴 |
| V3B-13 | Dropping a habit between two that share a key still works | same | ✅ 🔴 |
| V3B-14 | Nonsense moves are ignored; moves past either end are clamped | same | ✅ 🔴 |
| V3B-15 | ⭐ Archive hides a habit and drops it from today's count; unarchive restores it in place, with its streak | same | ✅ 🔴 |
| V3B-16 | Archiving twice, or archiving a deleted habit, changes nothing | same | ✅ 🔴 |
| V3B-17 | ⭐ Two devices reordering at once end up with both moves kept | same | ✅ 🔴 |
| V3B-18 | The display order: keys first, then habits with none, oldest first | same | ✅ 🔴 |
| V3B-19 | ⭐ Data saved before v3 loads with no position, and the storage version stays 2 | `lib/storage.test.ts` | ✅ 🔴 |
| V3B-20, 21 | A position goes to the database and back; an older build's row reads as "no position" | `lib/sync/sync.test.ts` | ✅ 🔴 |
| V3B-22 | ⭐ The same habit with its fields in a different order counts as unchanged (found by CI) | `lib/sync/merge.test.ts` | ✅ 🔴 |
| V3B-40 | ⭐ A position is stored in the real database and reaches another device | `supabase/tests/sync.test.ts` | ✅ |
| V3B-41 | An upload from an older build leaves the stored position alone | same | ✅ |
| V3B-42 | A habit an older build created reads back as "no position" | same | ✅ |
| V3B-43 | The database refuses a malformed position | same | ✅ |
| V3B-50 | ⭐ In a real browser: ↑ / ↓ reorder, focus stays put, the order survives a reload | `e2e/arrange.spec.ts` | ✅ |
| V3B-51 | Dragging a handle moves a habit | same | ✅ |
| V3B-52 | ⭐ The arrow keys move a habit from its handle, one press one place, focus staying put | same | ✅ |
| V3B-53 | ⭐ Archiving hides a habit; unarchiving brings it back in place, streak and all | same | ✅ |
| V3B-54 | Arrange appears only with two or more habits; adding waits while arranging | same | ✅ |
| V3B-55 | At 375px the three menu pills fit inside the card, with a long title | same | ✅ |
| V3B-56 | Every new control is at least 44×44 | same | ✅ |
| V3B-57 | ⭐ A new order reaches your other device | same | ✅ |

---

## Mutation checks

Each guard was broken on purpose, the tests run, and the file restored before the next run started.

| Broken on purpose | Caught by |
|---|---|
| Every move rewrites every habit's key (the "1, 2, 3" behaviour this block exists to avoid) | V3B-11, V3B-17 |
| Archived habits stay in today's list | V3B-14, V3B-15, and two older tests |
| The display order ignores `position` and goes by age | V3B-11…18, eight tests |
| New habits never get a key | V3B-10, V3B-11, V3B-17 |
| A malformed stored position is kept instead of being read as "none" | V3B-19's neighbour |
| The position column is never written to the database | V3B-20 |
| "Has this changed?" compares records as text, field order and all | V3B-22 |
| Unarchiving a habit that isn't archived rewrites the row anyway | V3B-16 |
| The order keys: no shared-prefix step, wrong midpoint, trailing zeros kept, "between two neighbouring digits" case | V3B-01…08 |

**Not mutation-checked:** the browser and database tests, which run only on CI. Same limit as every
block since v2 D.

---

## ⚠️ What CI found

### Round two: the menu pills, and the keyboard

- **A long title pushed the menu pills out past the card**, 46px beyond its right edge at 375px —
  caught by **V2A-36**, a test from v2 Block A, not by anything new. Adding the third pill was what
  tipped it over. My own check in the browser had used a short title, so I'd missed it. The cause:
  a flex item never shrinks below its content unless it is told it may (`min-w-0`). The title can
  now shrink, and while the menu is open it stays on one line and trails off, rather than
  collapsing into a column one word wide.
- **Keyboard reordering didn't work reliably.** The drag library's keyboard mode picks the habit
  up and drags it under measurements taken when the drag began, so the list moved out from under
  them: the first arrow press did nothing. Telling it to keep measuring helped, and left the test
  *flaky* — it failed, then passed on a retry. Flaky is not fixed, so the keyboard path is now
  **ours**: with the handle focused, ↑ and ↓ move the habit one place each, through exactly the
  same code as the ↑ / ↓ buttons. One press, one place, and focus stays on the handle. The library
  now handles only finger and mouse dragging, which it does well.

### Round one: the same record uploaded on every sync

The first CI run failed one database test: **V2D-42, "syncing an unchanged device again uploads
nothing"**. An unchanged device uploaded one habit on every sync, for good.

The cause was older than this block. Sync decides whether a record has changed by comparing the two
copies **as text**, and that depends on the order the fields happen to sit in. A habit built by the
app and the same habit read back from the database can hold the same fields in a different order.
Nothing had exposed it until `position` was added.

Two records that differ only in field order are now treated as the same, and the same fix applies
to the tie-break when two devices save at the very same instant — which has to be decided
identically on both, whatever order each holds its fields in (V3B-22).

---

## Known limits

- **"Latest change wins" is per habit, not per field.** If one device renames a habit at the same
  moment another moves it, one of those two edits is lost. Renames and archiving have always worked
  this way; the block adds one more field to the same rule.
- **The first rearrange by someone with habits from before v3** writes a key to every habit at once,
  so all of them count as edited that one time.
- **Archived habits can't be deleted from the archived list.** Unarchive first, then delete. Keeps
  the only destructive path in one place.
- **There is no "pick up and drop" keyboard mode.** With the handle focused, ↑ and ↓ move the habit
  straight away, one place per press. It is simpler to explain and it always works; what it loses
  is the drag library's own spoken "picked up… dropped" announcements during a keyboard move.
- **While a row's `⋯` menu is open, a long title is cut short** to make room for the three pills. It
  comes back in full as soon as the menu closes, which it does by itself after four seconds.

---

## Totals

| Suite | Count | Result |
|---|---|---|
| Unit (Vitest) | 287 | ✅ |
| Browser (Playwright), 88 tests × 2 devices | 176 runs | ✅ CI run 35501125626 |
| Database | 34 | ✅ |

---

## Your steps

1. **Your local database needs the new column** before the app can sync while you're signed in:
   `npx supabase migration up` (or `npm run db:reset` if you don't mind losing local test data).
2. **The live database needs it too**, before this reaches habibit.vercel.app: `npx supabase db push`.

## Optional check, yours

On your Android phone: arrange your habits with a drag, then archive one. Close the app, open it
again, and check the order stuck and the archived one is waiting under "Archived".
