# Habibit — v1 Block A Manual QA: Streaks & the 7-day strip

**Block:** A of 2 (v1) — Streaks & history
**Date tested:** ______   **Tester:** ______   **Browser:** ______

**Legend:** ⬜ untested · ✅ pass · ❌ fail · ⚠️ partial · ⏭️ skipped
**Who:** 🤖 = I already ran this and recorded the result · 👤 = needs your eyes

> **Habibit can now show you whether you are actually keeping it up.** Each habit
> grows a row of seven dots for the last week, any of which you can fill in, plus a
> streak count.
>
> None of this needed a data migration. The `completions` map has been keyed by
> `habitId::YYYY-MM-DD` since v0 Block 1 for exactly this moment, and
> `TOGGLE_COMPLETION` already accepted any date — the UI had simply always passed
> today.

Test against a production build:

```bash
npm run build && npx next start -p 3030
```

---

## 1. Build & tooling

| ID | What to check | How | Expected | Who | Status | Notes |
|----|---------------|-----|----------|:---:|:------:|-------|
| A-01 | Typecheck clean | `npm run typecheck` | No output | 🤖 | ✅ | |
| A-02 | Lint clean | `npm run lint` | No output | 🤖 | ✅ | |
| A-03 | Tests pass | `npm test` | `Tests 119 passed` | 🤖 | ✅ | Up from 97: 8 date + 14 streak/window tests |
| A-04 | Production build | `npm run build` | Compiles; `/` still `○ (Static)` | 🤖 | ✅ | |

---

## 2. The strip itself

| ID | What to check | How | Expected | Who | Status | Notes |
|----|---------------|-----|----------|:---:|:------:|-------|
| A-05 | Seven dots per habit | Add a habit | A row of 7 under the title | 🤖 | ✅ | |
| A-06 | Correct days, today on the right | Inspect any dot | Labels read Sat → Fri with the last marked "(today)" | 🤖 | ✅ | Verified the exact 7 dates |
| A-07 | Weekday letters line up | Look at the header row inside the card | S S M T W T F, aligned over the dot columns, **today's letter in coral** | 🤖 | ✅ | Shown once, not under every habit |
| A-08 | No future days | Try to find tomorrow | Not rendered at all — nothing to mis-tap | 🤖 | ✅ | |
| A-09 | Dots are comfortable to tap | — | Each target is **48×44px** | 🤖 | ✅ | Clears the 44px guideline; this is why the strip spans the full card width instead of being indented |
| A-10 | No horizontal scroll | 375px viewport | Cannot scroll sideways | 🤖 | ✅ | |
| A-11 | Rows are not too tall now | Add 5–6 habits and scroll | Still comfortable, not cramped or endless | 👤 | ⬜ | **Your call** — the strip adds roughly 44px per habit |

---

## 3. Filling in a day you missed

| ID | What to check | How | Expected | Who | Status | Notes |
|----|---------------|-----|----------|:---:|:------:|-------|
| A-12 | A past dot can be filled | Tap any earlier dot | It fills in | 🤖 | ✅ | |
| A-13 | It survives a reload | Fill a past dot, press F5 | Still filled | 🤖 | ✅ | |
| A-14 | The circle and today's dot stay in sync | Tick the big circle, watch the last dot. Then untick via the **dot**, watch the circle | They always agree, in both directions | 🤖 | ✅ | Both write the same completion key |
| A-15 | The progress badge still tracks today only | Tick a past dot | The `0/3` badge does **not** change | 🤖 | ✅ | Backfilling yesterday should not claim you did it today |

---

## 4. Streaks

| ID | What to check | How | Expected | Who | Status | Notes |
|----|---------------|-----|----------|:---:|:------:|-------|
| A-16 | Counts consecutive days | Fill four days in a row | Flame reads 4 | 🤖 | ✅ | |
| A-17 | ⭐ **An unfinished today does not zero it** | With a run going, leave today unticked | The streak still shows | 🤖 | ✅ | **The most important row here.** Otherwise every morning would read 0 until you ticked something |
| A-18 | Ticking today extends it | Tick today | 4 → 5 | 🤖 | ✅ | |
| A-19 | Hidden at zero | Look at a brand-new habit | **No flame at all**, not "🔥 0" | 🤖 | ✅ | See deviations — tell me if you want the 0 shown |
| A-20 | Stops at a gap | Leave a hole two days back | Only the run since the hole counts | 🤖 | ✅ | Unit-tested |
| A-21 | Filling a gap extends it | Fill the day just before a run | The streak grows by that much | 🤖 | ✅ | Verified live: 4 → 5 |
| A-22 | Habits don't share history | Two habits, one with a run | Only that one has a flame | 🤖 | ✅ | |
| A-23 | Midnight rollover | With a streak going, move your **OS clock** past midnight and return to the tab | The strip shifts by one, today's dot is empty, **and the streak still shows** | 👤 | ⬜ | ⭐ The one only a clock change can prove |

---

## 5. Both themes

| ID | What to check | How | Expected | Who | Status | Notes |
|----|---------------|-----|----------|:---:|:------:|-------|
| A-24 | Dots readable in dark | Switch to dark | Filled 6.51:1 and empty ring 5.20:1 against the card | 🤖 | ✅ | Measured on the rendered page, not just the tokens |
| A-25 | Dots readable in light | Switch to light | Same, against white | 🤖 | ✅ | |
| A-26 | Done vs not-done is not colour-alone | Squint, or imagine greyscale | One is a **solid** dot, the other a **hollow ring** | 🤖 | ✅ | Worth knowing: the two states are only 1.25:1 apart in brightness, so the fill/hollow difference is what carries it — which is why it is built that way |
| A-27 | Console clean | DevTools → Console | Nothing at all | 🤖 | ✅ | |
| A-28 | Looks right to you | Use it in both themes | The strip reads as progress, not clutter | 👤 | ⬜ | **Your call** |
| A-29 | Real phone | Open on your Android | Dots are easy to hit accurately with a thumb | 👤 | ⬜ | 48×44 measured, but thumbs are the real test |

---

## Summary

**Automated (🤖):** 25 ✅ / 0 ❌
**Yours (👤):** ___ ✅ / ___ ❌ / ___ ⚠️  — 4 rows: **A-11, A-23, A-28, A-29**

The one that matters most is **A-23** (midnight rollover with a streak running).

### Blockers
-

### Non-blocking
-

---

## Deviations from the mockup you approved

All four were flagged in the plan before I started; restating so they are easy to reject:

1. **The flame is a lucide icon, not the `🔥` emoji.** Everything else in the app uses lucide, and an emoji renders differently on every platform and cannot take a theme colour.
2. **The streak is hidden at 0** rather than showing "🔥 0" on every new habit.
3. **Weekday letters appear once**, in a header row inside the card, rather than under every habit.
4. **The strip spans the full card width** instead of being indented under the title. This is what buys 48×44px targets instead of ~37px.

---

## What Block A built

- **`lib/date.ts`** — `addDaysToKey`, plus `weekdayInitial` and `formatDateKeyLong` for the
  column letters and the dots' accessible names.
- **`store/selectors.ts`** — `recentDays` and `currentStreak`.
- **`components/habit/DayStrip.tsx`**, **`StreakBadge.tsx`**, **`WeekdayHeader.tsx`**.
- **`components/ui/ItemRow.tsx`** gained two optional slots, `trailing` and `below`, rather
  than being forked back into separate habit and task rows. Tasks pass neither and are
  unchanged — the row stays one primitive with the *meaning* living in the sections, which is
  the split `docs/backlog.md` argues for.

### The trap in this block

Stepping backwards through days must never be `time - 86_400_000`. Across a daylight-saving
boundary that lands 23 or 25 hours away and returns the wrong day, so a streak would break once
a year for everyone who observes DST — the same family as the UTC bug guarded in v0 Block 1.
`addDaysToKey` does calendar arithmetic **anchored at noon**, because some zones have skipped
midnight entirely when the clocks jumped. Month, year and leap-day rollovers are all tested.
