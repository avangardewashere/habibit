# Habibit

**Little habits. Lots of love.**

A gentle habit tracker for your phone. *Habibi* (love) + *habit* + *bit* (small).

**Live:** https://habibit.vercel.app — open it in Chrome on Android, then ⋮ → **Install app**.

---

## What it does

- **Daily habits** that reset every morning, and **one-off tasks** that stay done.
- **A 7-day strip** under every habit. Missed logging a day? Tap its dot to fill it in.
- **Streaks** that stay alive until midnight, so an unfinished today never zeros yesterday's run.
- **Rename or delete** from a single `⋯` menu. Renaming keeps the whole history.
- **Add several at once** by pasting a list, one habit per line.
- **Light, dark, or match your device.** Every colour pair meets WCAG AA in both themes.
- **Installable** as an app, and your data **stays on your device** (`localStorage`).

## Stack

Next.js 16 (App Router) · React 19 · TypeScript · Tailwind CSS 4 · Supabase (optional accounts) · Vitest + Testing Library · Playwright · deployed on Vercel.

No state library, UI kit or date library. State is one pure reducer in React context. Accounts use Supabase straight from the browser, protected by Row Level Security; without Supabase settings the app runs exactly as before, with no account button.

## Run it locally

Needs Node 20.9 or newer. Browser tests also need Chromium once (`npx playwright install chromium`), and the database and browser tests need **Docker Desktop** running for a local Supabase.

```bash
npm install
npm run dev
```

Then open http://localhost:3000.

| Command | What it does |
|---|---|
| `npm run dev` | Development server |
| `npm run build` then `npm start` | Production build, and serve it |
| `npm run check` | Everything: typecheck, lint, unit, database and browser tests. Run this before pushing |
| `npm run db:start` / `db:stop` | Start or stop the local Supabase in Docker (needed by `test:db` and `e2e`) |
| `npm run test:db` | Database tests (58): security (can one user reach another’s data?), sync, and who is due a reminder |
| `npm test` | Unit tests (352) |
| `npm run e2e` | Browser tests (97 tests, as an Android phone and as desktop Chrome) against a production build |
| `npm run e2e:report` | Open the last browser-test report, with a step-by-step trace of any failure |
| `npm run typecheck` | Generate Next route types, then TypeScript with no emit |
| `npm run lint` | ESLint |
| `npm run icons` | Regenerate every app icon from `assets/habibit Icon.svg` |

## Project layout

```
app/          Page, layout, PWA manifest, global CSS and theme tokens
components/   UI: habit/ and task/ sections, shared ui/ primitives
lib/          Pure logic with no React: dates, storage, theme, titles
store/        The reducer, selectors, and the provider that persists state
supabase/     Database migrations, local config, sign-in email, security tests
  functions/  send-reminders: the scheduled sender (Deno, runs inside Supabase)
  cron/       The alarm clock that wakes it, run once by hand
public/       Icons, and sw.js: the service worker that lets the app open offline
scripts/      Icon generation
e2e/          Browser tests (Playwright)
.github/      CI: every push runs the full check
docs/         Brand guide, backlog, version summary, and per-block QA checklists
```

## How it was built

In small, testable blocks. Through v1 each ended with a manual QA checklist signed off before
the next began; from v2 the checklist is automated and runs on GitHub for every push. The full story, including the bugs caught along the way, is in
[`docs/summary-v1.md`](docs/summary-v1.md). The per-block checklists are in [`docs/qa/`](docs/qa/).

## Where it's going

**v2 — accounts and sync.** Your habits on every device, plus offline support.
The first sign-in must upload existing local data, never replace it with an empty account.
