# Habibit: v4 Block A, undo

**Block:** A of 6 (v4) · **Date:** 2026-09-22 · **Status:** ⏳ CI running

> **A delete can be taken back.** After deleting a habit or a task, a bar at the bottom says
> *Deleted "Water"* and offers **Undo** for six seconds. Tap it and the habit is back exactly as it
> was — ticks, streak and history included.
>
> Building it turned up a v3 bug that is live right now, and it's fixed here too.

**Legend:** ✅ pass · 🔴 **proven**: shown to fail when the guard was deliberately broken · ⏳ on CI

---

## Your decision

| Question | Your choice |
|---|---|
| How long the Undo bar stays | **Six seconds** |

---

## What this block found, before any of it shipped

### 1. A v3 bug: reorder, archive and unarchive never synced live

Every edit reaches your account through one gate, `touchedBy` in `lib/sync/sync.ts`. It names each
kind of edit that should be sent. v3 Block B added reorder, archive and unarchive to the reducer
**but not to that gate**, so they fell through a `default` that said *"not an edit"* and never
entered the sync queue.

Nothing was lost: the full sync when the app next opens catches everything. But the promise v2 made
— *your edits reach your other devices within seconds* — didn't hold for those three. Archive a habit
on your phone, leave the app open, and your desktop never hears about it.

Undo would have fallen straight into the same gap. That's how it was found.

**The fix is structural, not three extra lines.** `touchedBy` now has no `default`: every action
type is named, and a type-level check means **a new action that isn't named is a compile error**.
Proven by removing one case — the build then fails with:

```
error TS2322: Type '{ type: "ARCHIVE_HABIT"; … }' is not assignable to type 'never'.
```

v4's schedule edits will add new actions. This is the guard that stops any of them repeating it.

### 2. The Undo button would have been unreadable in dark mode

The first version coloured the Undo label with the accent colour. Measured against the bar:

| | Message | Undo, in accent |
|---|---|---|
| Light | 15.28:1 | 4.64:1 |
| **Dark** | 14.84:1 | **2.08:1** ✗ |

Text needs 4.5:1. The one button that matters on this bar would have been close to invisible at
night. It now uses the message's colour, set apart by weight and an underline, and the pairing is in
`lib/contrast.test.ts` so it can't drift back.

---

## The timing rule that has to be exactly right

An undo must be **strictly newer** than the delete it undoes. Two rules elsewhere make "a few seconds
later" not good enough:

- on a tie, sync **deliberately keeps the delete** (`lib/sync/merge.ts`), so a tie can never bring
  back something deleted;
- the server keeps whatever it has when a write is **older**.

Wall clocks can go backwards — a phone correcting its time between the delete and the undo is enough.
Without a guard, that undo would work on screen and then **quietly lose to the delete on the next
sync**. So a restore is always stamped at least 1ms after the delete, whatever the clock says
(V4A-03, V4A-04, V4A-11).

---

## How it works

| Piece | Where | Job |
|---|---|---|
| The restore | `store/reducer.ts` — `RESTORE_HABIT`, `RESTORE_TASK` | clears the delete, strictly newer |
| The timing | `store/UndoProvider.tsx` | when the bar shows, and for how long |
| The drawing | `components/ui/UndoBar.tsx` | the bar itself, nothing else |

**Nothing is deleted when the bar goes away.** The delete already happened — as a soft delete, the
moment you tapped it — and already synced. The bar is only the window in which it can be reversed. So
there's no "commit" step to forget, and closing the app mid-countdown loses nothing but the chance to
undo.

**The countdown pauses while the bar is hovered or focused.** Six seconds is fine to glance at, and
hopeless to reach by keyboard or screen reader if it can vanish on the way. It restarts in full when
released.

**A second delete replaces the bar** rather than stacking; the first delete becomes final.

**Delete account is untouched.** It stays a deliberate, confirmed, irreversible step. Block F's tests
still cover it, unchanged.

---

## Tests

| ID | What it proves | Test | Result |
|---|---|---|---|
| V4A-01 | ⭐ A restored habit comes back exactly as it was, history included | `store/undo.test.ts` | ✅ 🔴 |
| V4A-02 | ⭐ The undo is newer than the delete | same | ✅ |
| V4A-03 | ⭐ An undo at the very same millisecond is still strictly newer | same | ✅ 🔴 |
| V4A-04 | ⭐ An undo after the clock went backwards is still strictly newer | same | ✅ 🔴 |
| V4A-05 | Restoring something never deleted changes nothing | same | ✅ 🔴 |
| V4A-06 | ⭐ Tasks can be taken back the same way | same | ✅ 🔴 |
| V4A-10 | ⭐ An undo made after the delete had synced still wins | same | ✅ |
| V4A-11 | ⭐ …even when stamped before the delete by a clock that went back | same | ✅ 🔴 |
| V4A-12 | ⭐ Another device that saw the delete brings the habit back | same | ✅ 🔴 |
| V4A-20 | ⭐ An undo is sent to the account | same | ✅ 🔴 |
| V4A-21 | ⭐ Reorder, archive and unarchive are sent to the account (the v3 gap) | same | ✅ 🔴 |
| V4A-22 | Things that aren't edits made here are still not sent | same | ✅ |
| V4A-30…37 | The bar: appears, undoes, leaves after 6s, replaces, fresh 6s, pauses on focus and hover, 44px | `store/UndoProvider.test.tsx` | ⏳ |
| — | Text on the undo bar reaches 4.5:1 in both themes | `lib/contrast.test.ts` | ✅ |
| V4A-50 | ⭐ In a real browser: a deleted habit comes back ticked, and stays back after a reload | `e2e/undo.spec.ts` | ⏳ |
| V4A-51 | ⭐ Left alone, the bar goes after six seconds and the delete stands | same | ⏳ |
| V4A-52 | ⭐ A deleted task can be taken back | same | ⏳ |
| V4A-53 | The bar causes no sideways scroll on a phone, and Undo is 44px | same | ⏳ |

### Why some rows are ⏳ rather than ✅

The bar's own tests (V4A-30…37) **could not start on this machine**: it has 1.4 GB of 16 GB free,
and the test workers time out before loading. A run that looked like "27 passed" turned out to be the
contrast file only — the undo file never ran. They are left as ⏳ until CI runs them, rather than
counted from a run that didn't happen.

---

## Mutation checks

| Broken on purpose | Caught by |
|---|---|
| The restore is not forced to be strictly newer | V4A-03, V4A-04, V4A-06, V4A-11 |
| A habit that was never deleted can be "restored" | V4A-05 |
| A restore is not sent to the account | V4A-20 |
| Reorder / archive / unarchive not sent to the account | V4A-21 |
| Deleting also throws the history away | V4A-01, V4A-12 |
| `touchedBy` missing a case | **compile error** (shown above) |

**Six guards, six caught** — five by tests, one by the type checker. The source files were verified
byte-identical to the originals afterwards.

---

## Known limits

- **Focus after a delete isn't moved to the Undo button.** A keyboard user who deletes has to reach
  the bar themselves; a screen reader announces it. Worth revisiting; not in this block.
- **Only the latest delete can be undone.** Deleting two things in a row makes the first final.
- **The window is six seconds, not "until you leave the page".** Your choice, and the usual one.
