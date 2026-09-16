# Habibit v1 — Summary

**Little habits. Lots of love.**
Live at **https://habibit.vercel.app** · Code at **https://github.com/avangardewashere/habibit**

From an empty folder on **2026-09-07** to a finished v1 on **2026-09-13**: three versions,
seven blocks, each ending with a manual QA checklist you signed off before the next began.

| | |
|---|---|
| Versions shipped | v0 → v0.5 → v1 |
| Blocks | 7, every one signed off |
| Tests | **145**, all passing |
| Runtime dependencies | 4 (`next`, `react`, `react-dom`, `lucide-react`) |
| Backend | None — data stays on the device |
| Supported devices | Android (Chrome) and desktop. iOS code ships but is unverified |

---

## What each version delivered

### v0 — the app itself (2026-09-07 → 09-08)

The goal was **not** a throwaway mockup. It was to get three expensive-to-change decisions right while
the app was still small enough to rewrite in an afternoon.

| Block | Delivered |
|---|---|
| **1 — Foundation & shell** | Next.js 16 project, brand tokens, layout, the data model, the reducer, date handling, 28 tests |
| **2 — Habits & tasks** | The working product: add, tick, delete; paste a list to add several; progress badge; empty states |
| **3 — PWA & ship** | App icons from your SVG, manifest, safe areas, public GitHub repo, deployed on Vercel, installable on Android |

State lived in memory only — a refresh wiped everything, on purpose.

### v0.5 — make it usable every day (2026-09-08 → 09-09)

| Block | Delivered |
|---|---|
| **A — Persistence** | Data survives refresh and restart; versioned storage; corrupt data recovered safely; two tabs stay in sync; two-tap delete |
| **B — Theming** | Dark mode with Light / Dark / Match-device; the palette split into brand and role colours; **six** accessibility fixes |

### v1 — show whether you're keeping it up (2026-09-11 → 09-13)

| Block | Delivered |
|---|---|
| **A — Streaks & the 7-day strip** | Seven dots per habit, tap a past day to fill it in, streak counts |
| **B — Renaming** | A `⋯` menu with Rename and Delete; renaming keeps all history |

---

## The three decisions that paid off

These were made in v0 Block 1, before there was anything to see.

**1. Completions are stored separately, keyed by `habitId::YYYY-MM-DD`.**
Not a list inside each habit. This is why v1's streaks and 7-day strip needed **no data migration** —
the data was already shaped for them. It also maps directly onto a database table for v2.

**2. Days are always the *local* calendar day.**
Using the UTC day would make checkmarks vanish at 8am in the Philippines. This came back in v1 as the
DST trap: stepping back a day with `time − 24h` breaks once a year in daylight-saving zones, so
`addDaysToKey` uses calendar arithmetic anchored at noon.

**3. Every change goes through one pure reducer.**
Nine actions (`ADD_HABIT`, `TOGGLE_COMPLETION`, `RENAME_HABIT`, `HYDRATE`…). Testable without a browser,
and in v2 this list becomes the API almost word for word. Backfilling past days in v1 needed **zero
reducer changes**, because `TOGGLE_COMPLETION` had accepted any date from the start.

---

## Bugs worth remembering

### The two you caught

These are the most important entries in this document. In both cases **my automated checks had marked
the rows ✅**, using simulated events that happened to avoid the exact conditions that trigger them.
Your manual QA found them.

| Where | Bug | Why it happened | Fix |
|---|---|---|---|
| v0.5 A | **Reloading wiped all your data** | The save guard was a "have we loaded yet?" flag. React's StrictMode can run the first render's save *after* the flag is set, writing the empty starting state over real data | The guard now compares the actual state objects, so there is no timing race to lose. Pinned by tests that render under StrictMode |
| v0.5 A | **Cancelling a delete ticked the habit** | A blur handler fired before the row's click, closing the confirm and letting the tap through | Removed the blur handler |

**The lesson:** a test that passes both with and without a fix is worthless. Since then, every fix has
been checked by temporarily removing it and confirming its test goes red.

### Caught before shipping

| Where | Bug |
|---|---|
| v0.5 B | A sixth contrast failure: the `×` icon at 2.29:1, as bad as the placeholder text |
| v0.5 B | With "Match device" selected, the phone's status bar stayed stuck on the last colour you tapped |
| v1 B | Cancelling one rename could silently lose the tap-away save of the *next* rename |
| v1 B | Enter during predictive text could save a half-typed name |
| v1 B | The Rename button was nearly invisible in dark mode (1.16:1) |

### Things I got wrong, and corrected

- **Service workers.** I said installing required one. Out of date: a manifest over HTTPS is enough.
- **Lighthouse.** Planned to verify install with it; Lighthouse removed its PWA checks in v12.
- **Misleading measurements.** A hidden test browser froze CSS transitions and reported the wrong colour.
- **A test's own mistake.** One rename test failed because it renamed to the *same* name, which the app
  correctly ignores.

---

## Ways of working that stuck

- **Blocks with a QA gate.** Small, testable pieces; nothing starts until the last one is signed off.
- **🤖 and 👤 rows.** Pre-filled checks I ran, plus checks only you can do on real hardware.
- **Measure, don't assume.** Tap-target sizes, contrast ratios and layout widths were measured on the
  real page. Measuring the rename button (178px → 130px of title space) changed the design to the `⋯` menu.
- **Ask when it's a real choice.** Stack, colours, dark ground, streak display, delete style — yours.
- **Android and desktop are the targets.** iOS support is kept but never blocks a release.
- **Components stay swappable.** A component either draws something or causes an effect, not both.

---

## Carried into v2

| Item | Status |
|---|---|
| **First sign-in must upload local data, not replace it** | ⚠️ The biggest v2 risk — same class of bug as the reload wipe, across a network. Put it at the top of the v2 plan |
| `emoji` and `archivedAt` fields | Unused since v0. Decide to use or drop them before they become database columns |
| Theme toggle → popup | In `docs/backlog.md`. Split its status-bar effect out first |
| Reordering, archiving, undo | Deferred by choice |
| Offline support | Planned for v2 alongside sync |

---

## Where to find things

| | |
|---|---|
| Per-block QA checklists | `docs/qa/` |
| Brand, palette and icon rules | `docs/brand.md` |
| Deferred work | `docs/backlog.md` |
| How to run, test and build | `README.md` |
