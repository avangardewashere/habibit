# Habibit — v1 Block B Manual QA: Renaming

**Block:** B of 2 (v1) — Renaming
**Date tested:** ______   **Tester:** ______   **Phone/browser:** ______

**Legend:** ⬜ untested · ✅ pass · ❌ fail · ⚠️ partial · ⏭️ skipped
**Who:** 🤖 = I already ran this and recorded the result · 👤 = needs your eyes

> **You can now fix a typo without losing a streak.** Before this block, the only
> way to correct "Drink watr" was to delete it — which threw away its history.
>
> The `×` on every row is now a **`⋯`** that opens **Rename** and **Delete** in
> place. You chose this over a separate pencil button because a second button on
> every row cost title space — measured at **178px → 130px** on a 375px phone.

```bash
npm run build && npx next start -p 3041
```

---

## 1. Build & tooling

| ID | What to check | How | Expected | Who | Status | Notes |
|----|---------------|-----|----------|:---:|:------:|-------|
| B-01 | Typecheck clean | `npm run typecheck` | No output | 🤖 | ✅ | |
| B-02 | Lint clean | `npm run lint` | No output | 🤖 | ✅ | |
| B-03 | Tests pass | `npm test` | `Tests 145 passed` | 🤖 | ✅ | Up from 119: 9 rename reducer tests + 17 row interaction tests — the first component tests in `components/` |
| B-04 | Production build | `npm run build` | Compiles; `/` still `○ (Static)` | 🤖 | ✅ | |

---

## 2. The `⋯` menu

| ID | What to check | How | Expected | Who | Status | Notes |
|----|---------------|-----|----------|:---:|:------:|-------|
| B-05 | `⋯` replaces `×` | Look at any habit or task | One `⋯` button, no `×` | 🤖 | ✅ | |
| B-06 | It opens Rename and Delete | Tap `⋯` | Two pills appear in place of `⋯` | 🤖 | ✅ | |
| B-07 | The streak steps aside | Tap `⋯` on a habit with a streak | The flame hides while the menu is open, returns when it closes | 🤖 | ✅ | Makes room for the two pills |
| B-08 | Nothing overflows | Open the menu at 375px | No sideways scroll; both pills inside the card | 🤖 | ✅ | Delete ends at 346px, card edge at 355px; title keeps 184px |
| B-09 | ⭐ **Tapping the row closes it without ticking** | Open the menu, tap the habit's name | Menu closes, **habit stays unticked** | 🤖 | ✅ | The v0.5 cancel-delete bug in a new form — pinned by a test |
| B-10 | Delete is still two taps | `⋯` → **Delete** | Removed. There is no single-tap path to delete | 🤖 | ✅ | |
| B-11 | It closes on its own | Open it and wait ~4 seconds | Back to `⋯` | 🤖 | ✅ | |

---

## 3. Renaming

| ID | What to check | How | Expected | Who | Status | Notes |
|----|---------------|-----|----------|:---:|:------:|-------|
| B-12 | The editor opens ready to type | `⋯` → **Rename** | An input with the current name, **already selected**, keyboard up | 🤖 | ✅ | Selected, so typing replaces it |
| B-13 | Enter saves | Type a new name, press Enter | Name changes | 🤖 | ✅ | |
| B-14 | ✓ saves | Type, tap the coral ✓ | Name changes, saved once | 🤖 | ✅ | |
| B-15 | Tapping away saves | Type a new name, then tap somewhere else on the page | Name changes | 👤 | ⬜ | ⭐ **Please test this one.** My automated browser couldn't hold real focus, so it could not produce a genuine blur. Verified with the underlying `focusout` event and unit-tested — but a real tap is the proof |
| B-16 | Escape cancels | Type something, press Escape | Original name kept, nothing saved | 🤖 | ✅ | Desktop keyboard only |
| B-17 | A blank name is rejected | Clear the field, press Enter | Original name kept — **the item is not deleted** | 🤖 | ✅ | |
| B-18 | ⭐ **The streak survives a rename** | Rename a habit that has a streak | Same flame count, same filled dots | 🤖 | ✅ | Verified live: "Drink watr" → "Drink water" kept its id, all 3 completions and its streak of 3. This is what ids are for |
| B-19 | A done task stays done | Tick a task, rename it | Still ticked | 🤖 | ✅ | Unit-tested |
| B-20 | The strip stays visible while editing | Rename a habit | The 7 dots remain underneath | 🤖 | ✅ | |
| B-21 | Survives a reload | Rename, press F5 | New name kept | 🤖 | ✅ | |
| B-22 | Android keyboard's action key saves | On your phone, rename and tap the keyboard's **Done / ✓** key | Saves | 👤 | ⬜ | The input asks for a "done" key; Android should send it as Enter |
| B-23 | Predictive text doesn't save early | On your phone, type a new name with keyboard suggestions on | Only saves when you actually press Done | 👤 | ⬜ | Guarded — see below |

---

## 4. Both themes

| ID | What to check | How | Expected | Who | Status | Notes |
|----|---------------|-----|----------|:---:|:------:|-------|
| B-24 | Rename pill looks like a button | Open the menu in **dark** mode | Visible outline, not loose text | 🤖 | ✅ | **Fixed during this block** — see below. Now 5.20:1 dark / 5.08:1 light |
| B-25 | Delete pill legible | Either theme | White on red | 🤖 | ✅ | 5.21:1 |
| B-26 | Edit field legible | Rename in dark mode | Text 14.84:1, coral border 6.51:1 | 🤖 | ✅ | |
| B-27 | Feels right in the hand | Rename and delete a few things on your phone | Menu is easy to hit, not fiddly | 👤 | ⬜ | **Your call** — including whether 4 seconds is long enough before it closes |

---

## Summary

**Automated (🤖):** 23 ✅ / 0 ❌
**Yours (👤):** ___ ✅ / ___ ❌ / ___ ⚠️  — 4 rows: **B-15, B-22, B-23, B-27**

**B-15 matters most** — it's the one path I couldn't genuinely exercise.

### Blockers
-

### Non-blocking
-

---

## Three things caught before shipping

**1. A leftover flag that would have silently dropped a rename.** Enter and Escape
mark "ignore the next blur", because the input can fire blur as it disappears. But
if the browser *doesn't* fire that blur, the flag stayed armed — and quietly swallowed
the tap-away save on your **next** rename. Each rename now starts with a clean flag.
There's a test that reproduces the exact sequence, and I confirmed it fails with the
fix removed.

**2. The Rename pill was nearly invisible in dark mode.** Its outline was 1.16:1
against the card, so it read as floating text rather than a button. Measured on the
rendered page, switched to a stronger outline.

**3. Enter during predictive text.** Keyboards that compose words (predictive text,
Chinese/Japanese input) use Enter to confirm a word, not the field. Without a guard
that would save a half-typed name. Also pinned by a test that fails without the guard.

One honest correction: while writing that last test I first used "Drink water" as the
new name — the same as the original — so the test failed for a reason that was **my
test's mistake**, not the app's. The app correctly skips saving an unchanged name.

---

## Deliberately NOT in this block

| Thing | Where it stands |
|---|---|
| Reordering | Skipped for v1, by your choice |
| Archive instead of delete | Hard delete kept, by your choice |
| Emoji on habits | Field exists in the data model, still unused |
| Undo after delete | Not planned — two taps is the safety net |
| The theme toggle as a popup | Recorded in `docs/backlog.md`; the `⋯` menu is a step in that direction |

---

## What Block B built

- **`store/reducer.ts`** — `RENAME_HABIT` and `RENAME_TASK`. They change only the title,
  trim it, and reject blanks. Completions are keyed by id, so history follows a rename
  with no extra work.
- **`components/ui/ItemRow.tsx`** — the `⋯` menu and inline editor. Three modes (normal,
  menu, editing) inside the one shared row, so habits and tasks got renaming together.
- **`components/ui/ItemRow.test.tsx`** — 17 interaction tests. This row has already
  shipped one focus-ordering bug, and renaming added three more blur-sensitive paths,
  so each one is pinned.
- **`vitest.config.mts`** — now also picks up tests under `components/`.
