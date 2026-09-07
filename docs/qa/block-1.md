# Habibit — Block 1 Manual QA

**Block:** 1 of 3 — Foundation & Shell
**Date tested:** ______   **Tester:** ______   **Device/browser:** ______

**Legend:** ⬜ untested · ✅ pass · ❌ fail · ⚠️ partial · ⏭️ skipped
**Who:** 🤖 = I already ran this and recorded the result · 👤 = needs your eyes

> Block 1 has **no features on purpose.** It builds the foundation: the brand, the
> layout, the data model, and the date handling. What you are checking is that the
> ground is level before we build eight components on it.
>
> Rows marked 🤖 are pre-filled with what I actually observed — spot-check any you
> want to see for yourself. Rows marked 👤 are things only you can confirm.

Run everything from `Shipped Products/habibit`.

---

## 1. Build & tooling

| ID | What to check | How | Expected | Who | Status | Notes |
|----|---------------|-----|----------|:---:|:------:|-------|
| B1-01 | Dependencies are installed | `npm install` | Completes, `found 0 vulnerabilities` | 🤖 | ✅ | 393 packages, 0 vulnerabilities |
| B1-02 | Dev server boots | `npm run dev` | Serves `http://localhost:3000`, no red errors in terminal | 🤖 | ✅ | Boots on :3000 |
| B1-03 | TypeScript is clean | `npm run typecheck` | No output at all (silence = pass) | 🤖 | ✅ | Clean |
| B1-04 | Lint is clean | `npm run lint` | No output at all | 🤖 | ✅ | Clean, 0 warnings |
| B1-05 | Unit tests pass | `npm test` | `Test Files 2 passed`, `Tests 28 passed` | 🤖 | ✅ | 28/28 |
| B1-06 | Production build succeeds | `npm run build` | `Compiled successfully`, route `/` marked `○ (Static)` | 🤖 | ✅ | Static prerender, no warnings |

---

## 2. Brand & shell

Open `http://localhost:3000`.

| ID | What to check | How | Expected | Who | Status | Notes |
|----|---------------|-----|----------|:---:|:------:|-------|
| B1-07 | Wordmark | Look at the title | Reads **Habibit**, with "Habi" in near-black and **"bit" in coral** | 🤖 | ✅ | `bit` = `rgb(242,84,91)` |
| B1-08 | Tagline | Under the wordmark | "Little habits. Lots of love." | 🤖 | ✅ | |
| B1-09 | Font is really Nunito | DevTools → Elements → `body` → Computed → `font-family` | `Nunito`, **not** falling through to `system-ui` | 🤖 | ✅ | `Nunito, "Nunito Fallback", ui-sans-serif…` |
| B1-10 | Background is cream, not white | Same panel, `background-color` on `body` | `rgb(255, 251, 247)` — visibly warmer than a white browser tab beside it | 🤖 | ✅ | |
| B1-11 | Does it *feel* like the brand? | Just look at it | Warm and soft, not clinical. If it reads as "generic startup app", say so | 👤 | ⬜ | **Your call — this is the one row I cannot check for you** |

---

## 3. Date correctness — the part that matters most

The single most expensive bug in a habit tracker is using the UTC day instead of
your local day. At UTC+8 that makes checkmarks vanish at 8 in the morning. These
rows prove it is handled.

| ID | What to check | How | Expected | Who | Status | Notes |
|----|---------------|-----|----------|:---:|:------:|-------|
| B1-12 | Header shows *your* date | Compare the app's date line to your phone's lock screen | Identical day and date | 👤 | ⬜ | |
| B1-13 | The date is client-only | Right-click → **View Page Source** (not Inspect), Ctrl+F for the month name | **Not found.** The raw HTML has `&nbsp;` there instead | 🤖 | ✅ | Server commits to no date — it cannot know your timezone |
| B1-14 | No layout shift when it fills in | Hard-reload (Ctrl+Shift+R) and watch the date line | Line already has its height; text appears without pushing anything down | 👤 | ⬜ | |
| B1-15 | Local day ≠ UTC day is tested | `npm test` output | `dateKey › uses the LOCAL calendar day, not the UTC day` passes | 🤖 | ✅ | Suite is pinned to `Asia/Manila` |
| B1-16 | Midnight rollover | DevTools → ⋮ → More tools → Sensors → set Location to a UTC+8 city. Then change your **OS clock** past midnight and switch back to the tab | Date line updates to the new day **without a refresh** | 👤 | ⬜ | Fires on both a midnight timer and tab-focus |

---

## 4. Layout & mobile

| ID | What to check | How | Expected | Who | Status | Notes |
|----|---------------|-----|----------|:---:|:------:|-------|
| B1-17 | No horizontal scroll on a phone | DevTools → device toolbar → iPhone SE / 375px wide | Cannot scroll sideways at all | 🤖 | ✅ | `scrollWidth 375 == clientWidth 375` |
| B1-18 | Centered column on desktop | Open at full window width | Content stays a phone-width column, centred, max 448px — not stretched across the screen | 🤖 | ✅ | `max-width: 448px` |
| B1-19 | Console is clean | DevTools → Console, hard-reload | No errors, **no hydration mismatch warning**. React DevTools info + `[HMR] connected` are fine | 🤖 | ✅ | Only those two info lines |
| B1-20 | Server-rendered, not a SPA shell | View Page Source, Ctrl+F "Little habits" | **Found** in the raw HTML — the shell renders on the server | 🤖 | ✅ | RSC boundary is correct |
| B1-21 | Looks right on your actual phone | `npm run dev -- -H 0.0.0.0`, then open `http://<your-PC-ip>:3000` on your phone | Readable, nothing cut off, comfortable margins | 👤 | ⬜ | Find your IP with `ipconfig` |

---

## Summary

**Automated (🤖):** 14 ✅ / 0 ❌
**Yours (👤):** ___ ✅ / ___ ❌ / ___ ⚠️  — 5 rows: **B1-11, B1-12, B1-14, B1-16, B1-21**

### Blockers — must be fixed before Block 2 opens
_(list failing IDs here)_

-

### Non-blocking — cosmetic, can ride along into Block 2
-

---

## Deliberately NOT in Block 1

Please don't file these as bugs — they are scheduled, not missing:

| Thing | Lands in |
|---|---|
| Adding a habit or task | Block 2 |
| Checkboxes, progress counter, empty states | Block 2 |
| The dashed "Foundation ready" placeholder box | Deleted in Block 2 |
| App icon, installability, manifest | Block 3 |
| Safe-area padding actually doing something | Block 3 (needs `viewport-fit=cover`) |
| **State surviving a refresh** | **v0.5 — v0 is in-memory by design** |
| Streaks, calendar, stats | v1 |
| Accounts, sync, offline | v2 |

---

## What Block 1 actually built

Worth knowing when you QA Block 2, because these are the pieces its bugs would come from:

- **`lib/types.ts`** — `Habit`, `Task`, and a **separate** `completions` map keyed by
  `habitId::YYYY-MM-DD`. One entry per (habit, day), which is exactly one future
  database row. This is why a habit can be checked today and unchecked tomorrow.
- **`lib/date.ts`** — `dateKey` / `parseDateKey`, both built from local calendar parts.
  Never `toISOString()`, never `new Date('2026-09-07')`.
- **`lib/useToday.ts`** — one source of "what day is it" for the whole client, which
  re-reads at midnight and whenever you return to the tab.
- **`store/reducer.ts`** — the six actions every write goes through
  (`ADD_HABIT`, `REMOVE_HABIT`, `TOGGLE_COMPLETION`, `ADD_TASK`, `TOGGLE_TASK`,
  `REMOVE_TASK`). Pure, so all 28 tests run with no browser.
- **`store/HabibitProvider.tsx`** — the React context Block 2's components read from.

### Deviations from the approved plan

| Plan said | Actually did | Why |
|---|---|---|
| TypeScript 7.0.2 | TypeScript 5.9.3 | `create-next-app` pins `^5`; the Next team has not validated the new native compiler yet. Following their pin is the safer call. |
| `@types/node ^20` (scaffold default) | `^24` | Vitest 5 requires ≥22, and your runtime is Node 24 — so the types now match reality instead of being pinned two majors behind. |
| Add `jsdom` + `@vitejs/plugin-react` | Neither | Every test is a pure function. Installing test infrastructure nothing imports would contradict the plan's own "no premature dependencies" rule. They go in when a component test does. |
| `components/ui/Button.tsx` | Not yet | Nothing in Block 1 uses it. It arrives in Block 2 with its first caller. |
| — | Added `lib/useToday.ts`, `lib/parseDateKey` | React 19's lint correctly rejected the `useEffect`+`setState` pattern I first used for the date. The fix (`useSyncExternalStore`) also gave us free midnight rollover, which Block 2 needs anyway. |
| — | Pinned `turbopack.root` in `next.config.ts` | A stray `package-lock.json` in `C:\Users\USER` made Turbopack warn on every build. |
