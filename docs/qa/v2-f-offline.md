# Habibit: v2 Block F, offline

**Block:** F of 6 (v2) · **Date:** 2026-09-18 · **Status:** ✅ all green on CI, waiting for your sign-off

> **Habibit now opens with no connection.** Not just "stays open" — you can close the tab on a train,
> open it again in a tunnel, tick things, and it all reaches your account by itself when the signal
> comes back.

**Legend:** ✅ pass · 🔴 **proven**: shown to fail when the guard was deliberately broken

---

## Your decisions

| Question | Your choice |
|---|---|
| How to build the service worker | **Hand-written**, about 60 lines we own, rather than the Serwist library |
| How to show being offline | **The Block E dot plus wording in the popup.** No banner |
| A new version while the app is cached | **Silently, on the next open.** No "tap to refresh" prompt |

---

## What I read first, and what it changed

Next 16 ships a new `experimental.useOffline` flag and a `useOffline()` hook. They look like exactly
this job, and they aren't: they retry the *framework's* own requests — page navigation, prefetching,
Server Actions. **Habibit makes none of those after it loads.** It talks to Supabase straight from the
browser, which that flag never sees. Turning it on would have added an experimental dependency that
could not watch our one real network call, so it stays off. Next's own docs point at a service worker
for real offline loading, which is what the plan already said.

---

## How it works

A service worker is a small script the browser keeps, which can answer the page's requests when the
network can't. Two rules, and nothing else:

| Request | What happens |
|---|---|
| **The page itself** | Try the network; keep a copy; if the network fails, serve the last copy. Online you always get the newest deploy, so a new version needs no prompt |
| **The app's build files** (`_next/static/…`) | Serve the kept copy, and fetch only what isn't kept yet. Their names contain a hash of their contents, so a kept copy can never be the wrong one |
| **Everything else** — Supabase above all | Untouched. **Nothing about your account is ever stored in a cache** |

Two details that matter:

- **A first visit already arms offline.** Files the page fetched *before* the worker took over never
  passed through it, so the page hands it the list when it's ready. Without that, offline would only
  work from the second visit.
- **Never in development.** There the app's files change on every keystroke and aren't hash-named, so
  a cache would serve yesterday's code. The browser tests run against a production build, so they
  still cover it.

And one change that isn't about the cache at all: **the connection returning now syncs at once**,
instead of waiting up to 30 seconds for the next check.

---

## 1. Handing over to the worker: `components/offline/ServiceWorker.test.tsx`

| ID | What it proves | Result |
|---|---|:---:|
| V2F-01 | ⭐ The app registers `/sw.js` when it loads | ✅ |
| V2F-02 | ⭐ It offers the worker **only this site's own build files** — not Supabase, not anything else | ✅ 🔴 |
| V2F-03 | A browser with no service workers is left alone, and the app works as before | ✅ |
| V2F-04 | A registration the browser refuses (a private window) changes nothing | ✅ |

## 2. Offline in the app: `store/SyncProvider.offline.test.tsx`

| ID | What it proves | Result |
|---|---|:---:|
| V2F-10 | ⭐ With no connection it says **you're offline**, not that something failed | ✅ 🔴 |
| V2F-11 | With a connection but no account, it still says the account couldn't be reached | ✅ |
| V2F-12 | ⭐ **The connection coming back syncs straight away**, not at the next 30-second check | ✅ 🔴 |

## 3. What you see: `components/account/AccountOffline.test.tsx`

| ID | What it proves | Result |
|---|---|:---:|
| V2F-20 | ⭐ Offline gets the **quiet** dot and says "Offline", rather than reporting a problem | ✅ 🔴 |
| V2F-21 | A failure with a working connection still reports a problem, in red | ✅ |
| V2F-22 | ⭐ The popup tells you you're offline as news, not as an error | ✅ 🔴 |

## 4. End to end, in a real browser: `e2e/offline.spec.ts` (on CI)

| ID | What it proves | Result |
|---|---|:---:|
| V2F-50 | ⭐ **With the network off, a reload still opens the app, with your habits** | ✅ |
| V2F-51 | Dark mode still arrives before the app does, offline — no white flash | ✅ |
| V2F-52 | ⭐ An edit made offline **reaches the account as soon as the connection returns**, with no reload | ✅ |
| V2F-53 | The popup says you're offline, and that nothing is lost | ✅ |

Each of these waits until the worker has actually kept everything the page needs before switching the
network off — otherwise the test would be measuring the wrong moment and passing by luck.

CI: **154 / 154 browser test runs** (77 tests, as an Android phone and as desktop Chrome), 251 unit tests
and 30 database tests, all green. Every Block A–E test still passes.

---

## 5. Proving the tests work

| Guard broken on purpose | Tests that failed |
|---|---|
| The connection returning no longer triggers a sync | 1 (V2F-12) |
| Every failure reported as "couldn't reach your account" | 1 (V2F-10) |
| Being offline treated as a fault | 1 (V2F-20) |
| Offline raised as an error in the popup | 1 (V2F-22) |
| The page offers the worker everything it loaded, wherever from | 1 (V2F-02) |

**Not proven this way:** the 4 browser tests in section 4, for the same reason as Blocks D and E —
browser tests need a production build, which your computer can't run alongside everything else, so
they only run on CI. The service worker's own rules are therefore held in place by those tests being
green, not by having watched them go red. It is the one part of v2 without that second layer of proof.

---

## 6. Known limits

| Limit | Impact |
|---|---|
| Offline needs **one online visit first** | The very first time Habibit is opened it must reach the network, as any website must. After that, it opens without one |
| The kept page is the one from your last online visit | A deploy you've never been online for isn't there yet. The app still opens; it's just the previous version until you have signal |
| Old caches are only cleared when the worker's own rules change | Each deploy leaves its build files behind — a few hundred kilobytes. Browsers clear them under storage pressure |
| Signing in, and syncing, still need a connection | Offline is about *using* the app. Your account is reached when there's signal |
| Edits waiting to go up are still held in memory | Unchanged from Block E: closing the tab loses the waiting list, **not the data** — the next open's full combine uploads it |

---

## 7. Your steps

Nothing to set up this time: the service worker ships with the app. Once this is merged and live:

1. Open `habibit.vercel.app` on your phone once with signal.
2. Turn on airplane mode and open it again from the home screen icon. It should open normally, with
   your habits, instead of the browser's "no internet" page.
3. Tick something, turn airplane mode off, and watch the dot on the account button clear by itself —
   **once the Vercel environment variables are set**, without which the live app has no account at all.
