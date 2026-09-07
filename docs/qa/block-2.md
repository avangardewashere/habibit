# Habibit — Block 2 Manual QA

**Block:** 2 of 3 — Habits & Tasks
**Date tested:** ______   **Tester:** ______   **Device/browser:** ______

**Legend:** ⬜ untested · ✅ pass · ❌ fail · ⚠️ partial · ⏭️ skipped
**Who:** 🤖 = I already ran this and recorded the result · 👤 = needs your eyes

> **This is the app.** Everything Habibit v0 promises is now working: add habits,
> add tasks, check them off, delete them. Block 3 only wraps it for your phone.
>
> The thing worth paying most attention to is **B2-25** — the difference between a
> habit and a task. That is the product.

Start with `npm run dev`, then open `http://localhost:3000`.

---

## 1. Build & tooling

| ID | What to check | How | Expected | Who | Status | Notes |
|----|---------------|-----|----------|:---:|:------:|-------|
| B2-01 | TypeScript clean | `npm run typecheck` | No output | 🤖 | ✅ | |
| B2-02 | Lint clean | `npm run lint` | No output | 🤖 | ✅ | 0 errors, 0 warnings |
| B2-03 | Unit tests pass | `npm test` | `Test Files 3 passed`, `Tests 33 passed` | 🤖 | ✅ | Up from 28 — added `lib/titles` |
| B2-04 | Production build | `npm run build` | `Compiled successfully`, `/` still `○ (Static)` | 🤖 | ✅ | |

---

## 2. Habits

| ID | What to check | How | Expected | Who | Status | Notes |
|----|---------------|-----|----------|:---:|:------:|-------|
| B2-05 | Add one habit | Type "Drink water" in **Add a habit…**, press Enter | Row appears; field clears and keeps focus so you can keep typing | 🤖 | ✅ | |
| B2-06 | **Add several at once** | Copy three lines from Notepad, paste into the habit field | **Three separate habits appear immediately.** No need to press Enter | 🤖 | ✅ | This is the "add multiple at a time" feature |
| B2-07 | Windows line endings | Same as above, pasted from Notepad specifically | No stray blank rows, no `\r` characters in titles | 🤖 | ✅ | CRLF handled |
| B2-08 | Blank input rejected | Type only spaces | The **+** button is greyed out; Enter does nothing | 🤖 | ✅ | |
| B2-09 | Long title wraps | Add a ~75-character habit | Text wraps onto 3 lines, row grows taller, **no sideways scrolling** | 🤖 | ✅ | Row grew 56px → 78px, no overflow |
| B2-10 | Checking works | Tap a habit row anywhere | Circle fills coral with a white tick; title goes grey and struck through | 🤖 | ✅ | |
| B2-11 | Progress counter | Check 2 of 3 | Badge top-right reads **2/3** | 🤖 | ✅ | |
| B2-12 | All-done state | Check every habit | Badge turns **solid coral with white text** instead of pale pink | 🤖 | ✅ | |
| B2-13 | Unchecking works | Tap a checked row again | Returns to empty circle, strikethrough gone, counter drops | 🤖 | ✅ | |
| B2-14 | Delete one habit | Tap the **×** on one row | Only that row disappears | 🤖 | ✅ | |
| B2-15 | Deleting a *checked* habit | Check a habit, then delete it | Counter goes from e.g. 6/7 to **5/6** — both numbers drop | 🤖 | ✅ | Its completion is purged, not orphaned |
| B2-16 | Does it feel good to tap? | Use it for a minute | Press feedback feels responsive, not mushy or laggy | 👤 | ⬜ | **Your call** |

---

## 3. Tasks

| ID | What to check | How | Expected | Who | Status | Notes |
|----|---------------|-----|----------|:---:|:------:|-------|
| B2-17 | Add a task | Type in **Add a task…**, press Enter | Row appears under TASKS | 🤖 | ✅ | |
| B2-18 | Checking sinks it | Add 3 tasks, check the **first** one | It moves to the **bottom** of the list, dimmed | 🤖 | ✅ | Order became Two, Three, One |
| B2-19 | "N left" counter | Check one of three | Header reads **2 left** | 🤖 | ✅ | |
| B2-20 | Unchecking restores it | Uncheck the completed task | Returns to its original position in the open group | 🤖 | ✅ | |
| B2-21 | Delete one task | Tap **×** on the middle task | Only that one goes | 🤖 | ✅ | |
| B2-22 | Tasks don't touch habits | Check and uncheck several tasks | No habit checkbox or counter changes at all | 🤖 | ✅ | |

---

## 4. The two models are genuinely different

This is the part that justifies the whole data model. If any of these is wrong,
the app is a to-do list wearing a habit tracker's name.

| ID | What to check | How | Expected | Who | Status | Notes |
|----|---------------|-----|----------|:---:|:------:|-------|
| B2-23 | Same title, separate items | Add "Stretch" twice, check only the first | Only the first gets ticked. They are independent | 🤖 | ✅ | Identity is the id, never the title |
| B2-24 | Refresh wipes everything | Add several items, press F5 | Back to both empty states. **This is correct for v0**, not a bug | 🤖 | ✅ | Persistence is v0.5 |
| B2-25 | **Habits reset overnight, tasks do not** | Check one habit **and** one task. Then change your **OS clock** to tomorrow and switch back to the tab | **The habit unchecks itself and the date updates. The task stays checked.** | 👤 | ⬜ | ⭐ **The single most important row in this suite** |
| B2-26 | Same thing, proven in code | `npm test` | `completions › is scoped to a single day…` passes | 🤖 | ✅ | Reducer-level proof of B2-25 |

---

## 5. Mobile & accessibility

| ID | What to check | How | Expected | Who | Status | Notes |
|----|---------------|-----|----------|:---:|:------:|-------|
| B2-27 | No horizontal scroll | DevTools device toolbar at 375px, with long titles added | Cannot scroll sideways | 🤖 | ✅ | |
| B2-28 | Touch targets big enough | — | Rows 56px tall; **×** and **+** both 44×44 | 🤖 | ✅ | Apple HIG minimum is 44 |
| B2-29 | No zoom-on-focus | Tap a text field **on a real iPhone** | Page does **not** zoom in | 👤 | ⬜ | Inputs measure 16px, which is the fix — but only a real iPhone confirms it |
| B2-30 | Keyboard operable | Tab to a habit row, press **Space** | Toggles. Tab order goes row → its delete → next row | 👤 | ⬜ | Order and focusability verified 🤖; the keypress needs a real keyboard |
| B2-31 | Screen reader | VoiceOver / Narrator on a row | Announces the title as a **checkbox**, "checked"/"unchecked" | 👤 | ⬜ | `role="checkbox"` + `aria-checked` are set |
| B2-32 | Real phone | `npm run dev -- -H 0.0.0.0`, open `http://<your-PC-ip>:3000` on your phone | Comfortable one-thumb use; nothing cramped or unreachable | 👤 | ⬜ | |

---

## Summary

**Automated (🤖):** 25 ✅ / 0 ❌
**Yours (👤):** ___ ✅ / ___ ❌ / ___ ⚠️  — 7 rows: **B2-16, B2-25, B2-29, B2-30, B2-31, B2-32**

### Blockers — must be fixed before Block 3 opens
_(list failing IDs here)_

-

### Non-blocking — cosmetic, can ride along into Block 3
-

---

## Deliberately NOT in Block 2

| Thing | Lands in |
|---|---|
| App icon on your home screen, installability | Block 3 |
| Safe-area padding actually doing something | Block 3 |
| Deployed public URL | Block 3 |
| **State surviving a refresh** | **v0.5 — v0 is in-memory by design** |
| Editing or reordering an existing item | v1 |
| Streaks, calendar, stats | v1 |
| Emoji on habits | v1 (the field exists in the data model, unused) |
| Accounts, sync, offline | v2 |

---

## What changed in Block 2

**New files**

- `components/ui/CheckCircle.tsx` — the coral tick, shared by both sections.
- `components/ui/ItemRow.tsx` — one checkable line: a big toggle button plus a
  separate 44px delete. Delete is always visible, because hover does not exist on a phone.
- `components/ui/Composer.tsx` — the add field. Enter adds one; pasting a
  multi-line list adds every line at once.
- `components/ui/SectionHeader.tsx`, `components/ui/EmptyState.tsx`
- `components/habit/HabitSection.tsx`, `components/task/TaskSection.tsx`
- `lib/titles.ts` + tests — the line-splitting rule, extracted so the
  "add several at once" feature is covered by unit tests rather than only by eye.

**Also:** brand tokens are now aligned to your icon (`docs/brand.md`), and
`app/page.tsx` lost the Block 1 placeholder box.

### Deviations from the approved plan

| Plan said | Actually did | Why |
|---|---|---|
| `HabitRow.tsx` + `TaskRow.tsx` | One shared `ui/ItemRow.tsx` | The two rows were pixel-identical; only their *meaning* differs, and that lives in the sections. Two copies of the same markup would drift apart. |
| `HabitComposer.tsx` + `TaskComposer.tsx` | One shared `ui/Composer.tsx` | Same reason — they differed only by placeholder and callback. |
| Composer splits on `\n` | Splits on `\r?\n`, and on **paste** rather than on submit | A single-line input is much better on a phone than a textarea. Intercepting multi-line *pastes* gets the bulk-add feature without degrading the everyday case. `\r\n` is what a Windows paste actually contains. |
| `ui/Button.tsx` | Not built | Still nothing that needs it. The two buttons in play are specific enough to own their styles. |

### One thing I checked that looked like a bug and wasn't

While testing, the "all habits done" badge appeared to stay pale pink at 3/3. It
turned out the automated browser had the page hidden, which freezes CSS
transitions, so the measurement returned the colour mid-fade. With transitions
disabled it reads the correct coral (`rgb(242, 84, 91)`). Flagging it because
**B2-12 is worth confirming with your own eyes** — that is the one row where my
tooling was actively misleading.
