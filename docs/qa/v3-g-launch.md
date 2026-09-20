# Habibit: v3 Block G, go live

**Block:** G of 7 (v3) · **Date:** 2026-09-24 · **Status:** ✅ the code is green on CI (run 35516875628), first try — the launch itself is yours

> **This is the block that makes Habibit public**, and most of it is not code. What I could build,
> I have built: a privacy page, a smoke test that checks the real site, and this checklist.
>
> **Nothing here has been done to the live app.** Every step below that touches an account, a
> password, a secret or a deploy is yours, because that is the standing rule for this project and
> because a launch is not a thing to do on someone's behalf.

**Legend:** ✅ pass · 🔴 **proven**: shown to fail when the guard was deliberately broken · ☐ yours to do

---

## What I built

| Piece | Where |
|---|---|
| The privacy page | `app/privacy/page.tsx`, linked from the footer and the sign-in panel |
| Tests that keep it honest | `components/legal/Privacy.test.tsx` |
| The live-site smoke test | `e2e-smoke/live.spec.ts`, `npm run smoke` |
| This checklist | you are reading it |

### The privacy page, and why it is tested

A privacy page is a set of promises, and the dangerous thing about promises in a repository is that
the code moves and the page doesn't. So the strong claims are tied to the code that makes them true:

- **"No analytics, no tracking pixels"** is checked against the actual dependency list (V3G-03). Add
  a tracker and the claim goes red before a reader ever believes it.
- **Every table the account holds** must be described somewhere on the page (V3G-04). The test reads
  the migrations and fails on a table no wording covers — so adding a new one without a word here is
  an obvious omission rather than a silent one.
- **It is reachable signed out** (V3G-05), because signed out is exactly when someone is deciding
  whether to hand over an email address.

These tests cannot make a promise true. They notice when the app and the page have drifted apart,
which is the failure that actually happens.

### The smoke test, and what it deliberately does not do

`npm run smoke` runs against **the real deployed site**, which answers a question no other test in
this repo asks: *did the thing that shipped survive shipping?* Missing environment variables, a
broken deploy, a service worker that never registers over real HTTPS, an icon that 404s — none of
those can fail on a machine building the app fresh.

**It never signs in and never creates an account.** The live database has real people in it, and by
the time this is worth running, one of them is you. Everything it does works signed out and touches
only its own browser storage.

---

## Tests

| ID | What it proves | Test | Result |
|---|---|---|---|
| V3G-01 | The page says what is kept, where, and how to remove it | `components/legal/Privacy.test.tsx` | ✅ |
| V3G-02 | ⭐ Every service involved is named | same | ✅ |
| V3G-03 | ⭐ "No analytics" is checked against the dependency list | same | ✅ |
| V3G-04 | ⭐ Every table the account holds is described | same | ✅ |
| V3G-05 | ⭐ It is reachable without an account | same | ✅ |
| V3G-06 | It answers "no account at all" first | same | ✅ |
| V3G-07 | It offers a way back into the app | same | ✅ |
| V3G-50 | ⭐ The live site is served and renders | `e2e-smoke/live.spec.ts` | ✅ live |
| V3G-51 | ⭐ A habit can be added and ticked on the real build | same | ✅ live |
| V3G-52 | ⭐ The service worker registers on the real origin | same | ✅ live |
| V3G-53 | ⭐ The app still opens with the network cut | same | ✅ live |
| V3G-54 | ⭐ Manifest and every icon it promises really exist | same | ✅ live (after a fix — see below) |
| V3G-55 | ⭐ The privacy page loads and is linked | same | ✅ live |
| V3G-56 | ⭐ Accounts are switched on in the deployed build | same | ❌ **accounts are off in production** |
| V3G-57 | The page reports no console errors | same | ✅ live |

### What the first real run found

Run against habibit.vercel.app straight after v3 was merged. **Seven of eight pass.** The two that
did not are worth separating, because they are completely different kinds of thing:

**V3G-56 is a real gap, and it is on your checklist.** There is no account button on the live site,
because the Supabase settings were never added to Vercel. Confirmed independently: the project URL
appears in none of the deployed JavaScript. Everything that does not need an account works; sync,
reminders and delete-account are simply not there yet.

**V3G-54 was a bug in my own test.** `new URL(icon.src, href)` used the manifest's *relative* path
as a base, and a relative string cannot be a base URL — so it threw `Invalid URL` before checking
anything. The live manifest and all three icons were fine the whole time (200, real file sizes).
Fixed to resolve against the page instead, and it passes.

That is a fair thing for a smoke test to catch about itself on its first real run, and a reminder
that a red test means "look", not "the site is broken".

---

## Mutation checks

Each claim was broken on purpose — sometimes by editing the page, sometimes by changing the app
*underneath* it — the tests run, and the original restored. **Six mutants, six caught.**

| Broken on purpose | Caught by |
|---|---|
| The page forgets to name a service it uses (Vercel) | V3G-02 |
| A tracker is added to the app, while the page still says there are none | V3G-03 |
| A new table is stored that the page never mentions | V3G-04 |
| The "no analytics" claim is replaced with something vague | V3G-03 |
| The only signed-out route to the page is removed | V3G-05 |
| The page stops saying how to delete your account | V3G-01 |

**Two of those are the interesting ones**, because the page was left untouched and the *app* moved:
adding `posthog-js` to the dependencies, and adding a `mood_diary` table to a migration. In both
cases the page went on making a promise that had just stopped being true, and in both cases a test
said so. That is the failure this page is actually exposed to — not someone editing it carelessly,
but everyone forgetting it exists.

---

## Your launch checklist

Work down it. Nothing here is urgent, and stopping half way leaves the app exactly as it is now —
working, private, and not yet announced.

### 1. The database

- ☐ `npx supabase db push` — sends every v3 migration to the live project: `habits.position`
  (Block B), the two reminder tables (Block D), the due-reminder functions (Block E), and
  `delete_my_account()` (Block F).
- ☐ Check it landed: in the Supabase dashboard, `public.reminder_settings` and
  `public.push_subscriptions` should exist, and `delete_my_account` should appear under Database →
  Functions.

### 2. Sign-in email that actually arrives

Supabase's built-in sender allows only a few emails an hour, shared across every project. That is
fine for you and hopeless for anyone else.

- ☐ Make an account with an email service. **Resend**'s free tier is the usual pick for Supabase
  (3,000 a month), and its Supabase guide is short.
- ☐ Verify a sending domain, or use their test sender while you decide.
- ☐ Supabase → Project Settings → Authentication → SMTP Settings: paste host, port, user, password,
  sender address and sender name. **You do this one** — it is an account and a password.
- ☐ Send yourself a sign-in code from the live app and confirm it arrives.

### 3. Addresses

- ☐ Supabase → Authentication → URL Configuration → **Site URL**: `https://habibit.vercel.app`
- ☐ Same page → **Redirect URLs**: add `https://habibit.vercel.app/auth/confirm`
- ☐ Without these, the link in the email lands somewhere that cannot sign anyone in.

### 4. Vercel

- ☐ Project → Settings → Environment Variables, for Production:
  - `NEXT_PUBLIC_SUPABASE_URL`
  - `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`
  - `NEXT_PUBLIC_VAPID_PUBLIC_KEY` — the **public** half only
- ☐ Redeploy, so the new values are baked into the bundle. They are read at build time, so an
  existing deploy will not pick them up.
- ☐ **The Supabase secret key and the VAPID private key never go here.** Vercel holds only what is
  already public in every visitor's browser.

### 5. Reminders

- ☐ `npx supabase secrets set VAPID_PUBLIC_KEY=... VAPID_PRIVATE_KEY=... VAPID_SUBJECT=mailto:you@example.com`
- ☐ `npx supabase functions deploy send-reminders`
- ☐ Dashboard → Integrations → Cron: a job every `*/15 * * * *` calling the `send-reminders` edge
  function. **Check the Authorization header carries the secret (service role) key** — the
  publishable one is in every browser and will be refused with a 401, which the function's logs will
  show plainly.
- ☐ The real check: set a reminder two or three quarter-hours ahead, leave a habit unticked, lock
  your Android phone, and wait for it to arrive.

### 6. Merge, in order

Six pull requests, stacked. Each one's base is the one before it, so they go in order and no merge
is a surprise.

- ☐ A (#6) theme popup
- ☐ B (#8) reorder & archive
- ☐ C (#9) weekly review
- ☐ D (#10) reminders, turning them on
- ☐ E (#11) reminders, sending
- ☐ F (#12) delete my account
- ☐ G (#13) go live

**Merging to `master` deploys to habibit.vercel.app.** Do step 1 (the database) before B and later
land, or the live app will ask for columns that are not there yet.

### 7. After the deploy

- ☐ `npm run smoke` — the eight checks above, against the real site.
- ☐ On your own phone: install it, add a habit, close it, turn on flight mode, open it again.
- ☐ Sign in on a second device and watch a habit arrive.
- ☐ Delete a throwaway account and confirm the habits stay on the device.

### 8. Then, and only then

- ☐ Tell someone.

---

## Known limits

- **The smoke test needs a deployed site**, so it cannot run in CI on a pull request. It is a
  post-deploy check, run by hand.
- **It does not test signing in.** That would mean creating accounts and sending real emails on the
  live project. Sign-in is covered against a throwaway database in the normal browser tests.
- **The privacy page is not legal advice.** It is an honest description of what the code does,
  written to be read rather than to satisfy a regulator. If Habibit ever has users in places with
  specific requirements, it will need more than this.
- **No rate limiting of our own.** Supabase limits sign-in emails; nothing else in the app has a
  cap. With a handful of people that is fine, and it is the first thing to revisit if that changes.
- **No way to export your data** beyond what is on the device. Worth having eventually; not in v3.

---

## Totals

| Suite | Count | Result |
|---|---|---|
| Unit (Vitest) | 375 | ✅ |
| Database | 64 | ✅ |
| Browser (Playwright), 103 tests × 2 devices | 206 runs | ✅ |
| Smoke (live site) | 8 tests × 2 devices | ☐ after deploy |

The first three are green on CI run 35516875628, first try. The smoke row is the only thing in v3
that cannot be ticked yet, and it is waiting on a deploy rather than on a fix.
