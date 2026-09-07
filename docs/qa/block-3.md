# Habibit — Block 3 Manual QA

**Block:** 3 of 3 — PWA, Polish & Ship
**Date tested:** ______   **Tester:** ______   **Phone/browser:** ______

**Legend:** ⬜ untested · ✅ pass · ❌ fail · ⚠️ partial · ⏭️ skipped
**Who:** 🤖 = I already ran this and recorded the result · 👤 = needs your eyes

> This block wraps the app for your phone. **Part A** is everything verifiable locally,
> and it is done. **Part B** cannot be done until the app is deployed, because
> installing a PWA requires a secure origin — `localhost` counts, but
> `http://192.168.x.x` does not, so your phone can only install it from the real
> HTTPS URL.
>
> ⚠️ **Lighthouse cannot check any of this any more.** Its PWA category was removed
> in v12, precisely because Chrome simplified the install rules. Use
> **DevTools → Application → Manifest** instead.

---

# Part A — Local (done)

Run against a **production** build, not `dev`:

```bash
npm run build && npx next start -p 3001
```

## A1. Build & assets

| ID | What to check | How | Expected | Who | Status | Notes |
|----|---------------|-----|----------|:---:|:------:|-------|
| B3-01 | Typecheck, lint, tests | `npm run typecheck && npm run lint && npm test` | All silent; `Tests 33 passed` | 🤖 | ✅ | |
| B3-02 | Production build | `npm run build` | Compiles; `/`, `/icon.svg`, `/apple-icon.png`, `/manifest.webmanifest` all `○ (Static)` | 🤖 | ✅ | 5 static routes |
| B3-03 | Icons regenerate from source | `npm run icons` | Rewrites all 5 variants from `assets/habibit Icon.svg` | 🤖 | ✅ | 27 heart tiles found |
| B3-04 | All assets serve | `curl -I` each icon URL | All **200**; PNGs `image/png`, favicon `image/svg+xml`, manifest `application/manifest+json` | 🤖 | ✅ | 6/6 |
| B3-05 | Icon dimensions are truthful | Load each and read `naturalWidth` | Actual pixels match the `sizes` declared in the manifest | 🤖 | ✅ | 192×192, 512×512, 512×512 |

## A2. Manifest & head tags

| ID | What to check | How | Expected | Who | Status | Notes |
|----|---------------|-----|----------|:---:|:------:|-------|
| B3-06 | Manifest is valid JSON | `curl localhost:3001/manifest.webmanifest` | Parses; name, id, scope, display, colours, 3 icons | 🤖 | ✅ | |
| B3-07 | Status bar colour | View source | `<meta name="theme-color" content="#FFFBF7">` | 🤖 | ✅ | Cream, per your choice |
| B3-08 | Safe areas switched on | View source | viewport has `viewport-fit=cover` | 🤖 | ✅ | Without this the padding is inert |
| B3-09 | Pinch-zoom NOT disabled | View source | **No** `maximum-scale` or `user-scalable=no` | 🤖 | ✅ | Disabling zoom is an a11y failure; 16px inputs fix iOS properly |
| B3-10 | iOS home-screen name | View source | `<meta name="apple-mobile-web-app-title" content="Habibit">` | 🤖 | ✅ | This is what stops it saying "localhost" |
| B3-11 | Safe-area padding on all 4 edges | Search CSS for `safe-area-inset` | top, right, bottom, left all present | 🤖 | ✅ | |
| B3-12 | Installability preconditions | DevTools → **Application → Manifest** | No installability errors | 🤖 | ✅ | All 10 preconditions verified programmatically: secure context, manifest parses, name, start_url same-origin + in scope, display standalone, 192 + 512 + maskable present, all icons load |

## A3. Icon quality

| ID | What to check | How | Expected | Who | Status | Notes |
|----|---------------|-----|----------|:---:|:------:|-------|
| B3-13 | Reads as a heart when small | Look at the browser tab | Recognisable coral heart | 🤖 | ✅ | Clear from ~24px up. At 16px it reduces to a coral blob — normal for a detailed mark, and why the tab icon stays vector |
| B3-14 | Maskable is not clipped | DevTools → Application → Manifest → the maskable preview | Whole heart visible with margin all round | 🤖 | ✅ | Heart scaled to 0.82; extremes ~173 from centre vs the 204.8 safe radius |
| B3-15 | ⭐ **Gradient top row on cream** | Open `public/icons/icon-512.png` at full size, then glance at it small | Top row still reads as part of the heart, not washed out | 👤 | ⬜ | **The risk I flagged.** The gradient was drawn for a dark plate; on cream the top loses contrast. If it looks faint, say so — darkening `habibit-400` is a one-line fix |
| B3-16 | Cream plate looks right | Look at the icon against a white background and a dark one | Reads as intentional, not like a missing background | 👤 | ⬜ | **Your call** |

---

# Part B — After deploy (blocked until the app is live)

## B1. Deploy

| ID | What to check | How | Expected | Who | Status | Notes |
|----|---------------|-----|----------|:---:|:------:|-------|
| B3-17 | Repo exists and is private | `gh repo view habibit` | Private repo, 4 commits | 🤖 | ⬜ | Pending your go-ahead — pushing is the first outward-facing step |
| B3-18 | Vercel deploy succeeds | vercel.com/new → Import `habibit` → **Deploy** | Build passes, you get a `https://….vercel.app` URL | 👤 | ⬜ | **Yours** — I can't sign into your Vercel account. ~2 min, no configuration needed |
| B3-19 | Deployed build has no dev leftovers | Open the live URL | Same app, no Next dev overlay | 👤 | ⬜ | |

## B2. Installing it

| ID | What to check | How | Expected | Who | Status | Notes |
|----|---------------|-----|----------|:---:|:------:|-------|
| B3-20 | Desktop Chrome offers install | Open the live URL → ⋮ menu | **Install Habibit** appears | 👤 | ⬜ | Note: no *automatic* prompt will pop — see "Known limits" below |
| B3-21 | Android install | Chrome on the phone → ⋮ → Install app | Installs; icon on the home screen | 👤 | ⬜ | Skip if you're on iOS |
| B3-22 | iOS install | Safari → Share → **Add to Home Screen** | Sheet shows **"Habibit"** and your heart icon | 👤 | ⬜ | Must be Safari; Chrome on iOS can't install |
| B3-23 | Icon on the home screen | Look at it among your other apps | Sharp, correctly shaped, not letterboxed or double-rounded | 👤 | ⬜ | |
| B3-24 | Launches like an app | Tap the home-screen icon | **No address bar, no browser chrome** | 👤 | ⬜ | This is the payoff of `display: standalone` |
| B3-25 | Status bar blends | Look at the top of the screen once launched | Cream status bar, **no visible seam** above the wordmark | 👤 | ⬜ | Your colour choice — worth confirming it looks how you pictured |
| B3-26 | Nothing hidden by the notch | Scroll to the bottom; rotate to landscape | Last row clears the home indicator; nothing under the notch in landscape | 👤 | ⬜ | |
| B3-27 | Survives a restart | Restart the phone, tap the icon | Still opens standalone | 👤 | ⬜ | |

## B3. The app still works in production

| ID | What to check | How | Expected | Who | Status | Notes |
|----|---------------|-----|----------|:---:|:------:|-------|
| B3-28 | Core flows intact | Add habits and tasks, check, delete | Everything from Block 2 behaves identically | 👤 | ⬜ | |
| B3-29 | No zoom on input tap | Tap **Add a habit…** on a real iPhone | Page does **not** zoom | 👤 | ⬜ | The row Block 2 couldn't finish without a real device |
| B3-30 | No horizontal scroll | Add a very long habit title | Wraps; no sideways scroll | 👤 | ⬜ | |
| B3-31 | Loads on mobile data | Turn Wi-Fi off, open the app | Loads fine | 👤 | ⬜ | It needs a connection — there's no offline support in v0 |

---

## Summary

**Automated (🤖):** 14 ✅ / 0 ❌
**Yours (👤):** ___ ✅ / ___ ❌ / ___ ⚠️  — 17 rows, of which **B3-15** is the one I'd most like your opinion on

### Blockers
-

### Non-blocking
-

---

## How to deploy (your two minutes)

Once I've pushed the repo:

1. Go to **vercel.com/new**
2. Sign in with GitHub, grant access to the `habibit` repo if asked
3. Click **Import** next to `habibit`
4. Change nothing — Next.js is auto-detected
5. Click **Deploy**, wait ~90 seconds
6. Copy the `https://….vercel.app` URL and open it on your phone

The free tier covers far more traffic than 1000 users of a static page, and HTTPS is included — which is
the thing that makes the app installable.

---

## Known limits of v0 — not bugs

| Behaviour | Why | Fixed in |
|---|---|---|
| **Chrome never pops its own install prompt** | Installing from the ⋮ menu no longer needs a service worker, but the *automatic* prompt heuristic still wants a fetch handler. You can always install manually | v2 |
| **Doesn't work offline** | No service worker, and nothing to be offline with while state is in memory | v2 |
| **Refresh still wipes your data** | v0 is in-memory by design | v0.5 |
| No push reminders | Needs a service worker plus a backend to hold subscriptions | v3 |

---

## What Block 3 built

- **`scripts/generate-icons.mjs`** + `npm run icons` — derives all 5 icon variants from your one source
  SVG, which is never edited. `sharp` is a devDependency and the PNGs are committed, so Vercel's build
  never needs it.
- **`app/manifest.ts`** — identity, cream colours, 3 icons including a maskable one.
- **`app/layout.tsx`** — `viewport` export (`viewport-fit=cover`, cream `themeColor`) and `appleWebApp`
  metadata so iOS shows "Habibit".
- **`components/layout/AppShell.tsx`** — safe-area padding extended to all four edges.
- Removed the now-unused `--color-plum` token, and updated `docs/brand.md` for the cream plate.

### Deviations from the approved plan

| Plan said | Actually did | Why |
|---|---|---|
| 3 commits, one per block | 3 commits grouped by block, authored at the end | The blocks were built in one session with no commits in between, and several files (`layout.tsx`, `globals.css`, `AppShell.tsx`) were touched by more than one block. The commits group the work and each one builds, but they are a grouping, not a literal chronology — worth knowing if you ever `git bisect`. |
| Lighthouse verifies installability | DevTools → Application → Manifest | Lighthouse deleted its PWA category in v12. |
| `apple-mobile-web-app-capable` | Next emits `mobile-web-app-capable` | Next 16 uses the standardised name; the Apple-prefixed one is deprecated. |
