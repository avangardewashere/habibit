# Habibit: v2 Block A, the test safety net

**Block:** A of 6 (v2) · **Date:** 2026-09-16 · **Status:** ✅ all green, waiting for your sign-off

> **From here on, the checklist runs itself.** This block changes nothing in the app. It builds the
> tool that replaces manual QA: browser tests that open the real app, tap, reload and read storage the
> way you did by hand, running automatically on GitHub for every push.

**Legend:** ✅ pass · ❌ fail · 🔴 **proven**: shown to fail when the fix it guards was deliberately removed

---

## How to run it

| Command | What it does | Time |
|---|---|---|
| `npm run check` | Everything below, in order. **This is the new sign-off** | ~2 min |
| `npm run e2e` | Builds the app for production, then runs the browser tests | ~1.5 min |
| `npm run e2e:report` | Opens the last run's report, including a step-by-step trace of any failure | — |
| `npm test` | Unit tests only (unchanged) | ~5 s |

The browser tests run twice: once as an **Android phone** (Pixel 7) and once as **desktop Chrome**.
37 tests × 2 = **74 runs**. The phone-width tests pin a 375px screen in both.

---

## 1. Tooling

| ID | What it proves | Evidence | Result |
|---|---|---|:---:|
| V2A-01 | Types, lint, unit tests still pass | `npm run check`: 145 unit tests | ✅ |
| V2A-02 | Browser tests pass on a clean production build | 74 passed | ✅ |
| V2A-03 | **They aren't flaky** | Whole suite 3× in a row: **222 / 222** passed | ✅ |
| V2A-04 | GitHub runs everything on every push | `.github/workflows/ci.yml`; see the Actions tab | ✅ once the first run is green |

---

## 2. What each test protects

The **Was** column shows the manual row a test replaces, so you can trace every one back.

### Persistence: `e2e/persistence.spec.ts`

| ID | What it proves | Was | Result |
|---|---|---|:---:|
| V2A-05 | Habits, ticks and tasks survive a reload | v0.5 A-06 | ✅ |
| V2A-06 | ⭐ Data survives **six reloads in a row** | v0.5 A-07 | ✅ |
| V2A-07 | Data survives closing the tab and opening a new one | v0.5 A-08 | ✅ |
| V2A-08 | A second open tab picks up changes, both ways | v0.5 A-16/17 | ✅ 🔴 |
| V2A-09 | Corrupt data is quarantined, and the app still starts | v0.5 A-12/13 | ✅ 🔴 |

### The row, `⋯` menu and renaming: `e2e/rows.spec.ts`

| ID | What it proves | Was | Result |
|---|---|---|:---:|
| V2A-10 | ⭐ Tapping the row while the menu is open closes it **without ticking** | v1 B-09 | ✅ 🔴 |
| V2A-11 | Delete takes two taps and stays deleted after reload | v1 B-10 | ✅ |
| V2A-12 | The menu closes on its own after ~4 s (fake clock, not waiting) | v1 B-11 | ✅ |
| V2A-13 | The editor opens with the name selected | v1 B-12 | ✅ |
| V2A-14 | Enter saves, and it survives a reload | v1 B-13/21 | ✅ |
| V2A-15 | The ✓ button saves | v1 B-14 | ✅ |
| V2A-16 | ⭐ **Tapping away saves**, with real browser focus | v1 **B-15** | ✅ |
| V2A-17 | Escape cancels | v1 B-16 | ✅ |
| V2A-18 | Cancelling one rename doesn't lose the next one's tap-away save | v1 B caught bug | ✅ 🔴 |
| V2A-19 | A blank name is rejected; the habit isn't deleted | v1 B-17 | ✅ |
| V2A-20 | ⭐ Renaming keeps the streak and the filled dots | v1 B-18 | ✅ |
| V2A-21 | A done task stays done after renaming | v1 B-19 | ✅ |

### Streaks and the 7-day strip: `e2e/streaks.spec.ts`

| ID | What it proves | Was | Result |
|---|---|---|:---:|
| V2A-22 | Seven dots, the right dates, today on the right | v1 A-05/06 | ✅ |
| V2A-23 | Streaks count per habit; no flame at zero | v1 A-16/19/22 | ✅ |
| V2A-24 | ⭐ An unfinished today doesn't zero the streak | v1 A-17 | ✅ 🔴 |
| V2A-25 | ⭐ **At midnight** the strip moves on and the streak survives | v1 **A-23** (was: change your OS clock) | ✅ 🔴 |
| V2A-26 | A phone that **slept through midnight** catches up when it wakes | new | ✅ 🔴 |
| V2A-27 | Filling a past day sticks, extends the streak, leaves today's badge alone | v1 A-12/13/15/21 | ✅ |
| V2A-28 | The big circle and today's dot always agree | v1 A-14 | ✅ |

### Theming: `e2e/theme.spec.ts`

| ID | What it proves | Was | Result |
|---|---|---|:---:|
| V2A-29 | ⭐ **No white flash**: dark is set before any app markup exists | v0.5 **B-18** | ✅ 🔴 |
| V2A-30 | Light and dark apply, and survive a reload | v0.5 B-14/15/17 | ✅ |
| V2A-31 | "Match device" follows the OS and stores nothing | v0.5 B-16/19 | ✅ |
| V2A-32 | On "Match device", the status bar gets both colours | v0.5 B-20 | ✅ 🔴 |
| V2A-33 | Forcing light on a dark device pins cream | v0.5 B-21 | ✅ |
| V2A-34 | Forcing dark on a light device pins plum | v0.5 B-22 | ✅ |
| V2A-35 | ⭐ Switching back to "Match device" restores the pair | v0.5 B-23 bug | ✅ 🔴 |

### Layout and installing: `e2e/layout.spec.ts`

| ID | What it proves | Was | Result |
|---|---|---|:---:|
| V2A-36 | No sideways scroll at 375px, even with long titles and the menu open | v1 A-10, B-08 | ✅ |
| V2A-37 | Every tap target is at least 44×44 (13 measured) | v1 A-09 | ✅ 🔴 |
| V2A-38 | Pasting a list adds one habit per line | v0 Block 2 | ✅ |
| V2A-39 | The console stays clean (no hydration errors) | v0.5 A-10, v1 A-27 | ✅ |
| V2A-40 | The manifest is served and describes the app | v0 Block 3 | ✅ |
| V2A-41 | Every icon the app points to actually exists | v0 Block 3 | ✅ |

---

## 3. Proving the tests work

A test that passes whether or not the bug is there is worse than no test, because it gives you
false confidence. So I put **ten old bugs back into the app**, one guard at a time, rebuilt it, and
checked that the tests went red.

| Bug put back | Caught by |
|---|---|
| Tapping a row with the menu open ticks it | V2A-10 |
| A cancelled rename's leftover flag eats the next save | V2A-18 |
| An unfinished today zeroes the streak | V2A-24, V2A-25 |
| The midnight timer's backup (tab becoming visible) removed | V2A-26 |
| The pre-paint theme script removed | V2A-29 |
| "Match device" pins one status-bar colour | V2A-32, V2A-35 |
| Strip dots shrunk to 36px | V2A-37 |
| Corrupt data thrown away instead of quarantined | V2A-09 |
| The other-tab listener removed | V2A-08 |
| ⚠️ **The v0.5 reload-wipe guard removed** | **No browser test.** Caught by `store/HabibitProvider.test.tsx` (4 tests fail) |

### The one the browser couldn't catch, and why that's fine

The reload wipe only ever happened under React's **StrictMode**, which runs in `next dev` and never in a
production build. Browser tests deliberately run production, so they can't trigger it; with the guard
removed, V2A-05 to V2A-07 still passed. The **unit test** renders under StrictMode on purpose, and it
fails as it should. So the bug is covered, just by the other kind of test. It's worth knowing that
each kind catches different things.

---

## 4. Not automated, and why

Nothing here is marked as passed. These are **optional** checks for when you want them.

| Old row | Why a test can't do it |
|---|---|
| v0.5 A-09: no flash of "No habits yet" on reload | Whether one frame gets painted isn't something a test can observe reliably |
| v0.5 B-24: status bar on the **installed** Android app | Needs a real installed app. V2A-32 to V2A-35 check the metas it reads |
| v1 B-22/B-23: Android keyboard's Done key, predictive text | Real keyboards send different events from simulated ones. Guarded by unit tests |
| All "does it look/feel right" rows | Taste, not correctness |
| Contrast ratios | Already covered by `lib/contrast.test.ts` |
| iOS | Never required |

---

## 5. What this block added

| File | Purpose |
|---|---|
| `playwright.config.ts` | Production build, Android + desktop, pinned to Asia/Manila so "today" is stable |
| `e2e/helpers.ts` | Seeding a week of history, finding rows and dots by their accessible names |
| `e2e/*.spec.ts` | The 37 tests above |
| `.github/workflows/ci.yml` | Runs `typecheck → lint → unit → browser` on every push |
| `package.json` | `e2e`, `e2e:report`, `check` scripts; `@playwright/test` |

**No app code changed.**

### Deviations from the plan

| Plan said | Actually | Why |
|---|---|---|
| Port the "no flash of the empty state" row | Not ported | See section 4. The *dark-mode* flash (V2A-29) **was** automatable, because its cause is a DOM attribute |
| Tests prove themselves | 9 of 10 through browser tests, 1 through a unit test | The reload-wipe bug needs StrictMode, which production doesn't have |
| — | Added V2A-26 (slept through midnight) | It's the path phones actually take, and it had never been tested |
