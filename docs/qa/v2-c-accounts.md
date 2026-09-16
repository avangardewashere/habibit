# Habibit: v2 Block C, accounts

**Block:** C of 6 (v2) · **Date:** 2026-09-17 · **Status:** ✅ all green, waiting for your sign-off

> **You can now sign in, and nothing else changes yet.** A new account button in the header sends a
> 6-digit code and a link to your email. Signing in doesn't move or sync any habits; that's Block D.
> The part that matters most here is invisible: **the database itself refuses to let anyone see or
> change anyone else's data**, and that is proven by tests that attack it.

**Legend:** ✅ pass · 🔴 **proven**: shown to fail when the guard was deliberately broken

---

## How to run it

Block C adds a third kind of test, which needs Docker Desktop running:

```bash
npm run db:start
npm run check
```

| | Before | Now |
|---|---:|---:|
| Unit tests | 180 | **183** |
| Database security tests *(new)* | — | **19** |
| Browser tests | 44 (88 runs) | **57 (114 runs)** |

| New command | What it does |
|---|---|
| `npm run db:start` | Starts a private Supabase inside Docker, built from `supabase/migrations` |
| `npm run test:db` | The database security tests |
| `npm run db:reset` | Rebuilds the local database from the migrations |
| `npm run db:stop` | Stops it |

**No test ever touches your real Supabase project.** Unit tests need nothing; database and browser
tests use the local copy in Docker, and so does GitHub CI.

---

## 1. Decisions made in this block

| Decision | Choice | Why |
|---|---|---|
| Sign-in email | **Code + link** (your choice) | On Android a link tapped in Gmail may open Chrome instead of the installed app. The code signs the app itself in |
| Link type | **One-time `token_hash`**, not the Supabase default (PKCE) | A PKCE link only works in the browser that asked for it, which is exactly the Android problem above. V2C-23 proves the link works elsewhere |
| Where sign-in runs | **Entirely in the browser** | All data access will happen in the browser, so no server session is needed and both pages stay static |
| Row keys | **`(user_id, id)`**, not `id` alone | Ids are made on devices. Keyed per user, one person can't collide with or squat on another's ids (V2C-14) |
| Sign out | **This device only**, and **local habits untouched** | The account holds no data yet, so the device's habits are the only copy. What sign-out does once sync exists is Block D's decision |
| A build without Supabase settings | **No account button at all** | Forks and previews work exactly like v1. This also means merging is harmless until the keys are added to Vercel |

---

## 2. ⭐ The security boundary: `supabase/tests/row-level-security.test.ts`

Habibit's browser talks to the database directly, with a key that is **public by design**. Anyone can
open DevTools and send any query with it. So the rules have to live in the database, where a modified
browser can't skip them. These tests create real users and try to break in.

| ID | What it proves | Result |
|---|---|:---:|
| V2C-01 | Signed out: no access to habits, tasks or completions at all (3 tests) | ✅ 🔴 |
| V2C-02 | Signed out: can't write anything | ✅ |
| V2C-03 | A user reads back their own habit, task and completion | ✅ |
| V2C-04 | `user_id` comes from the sign-in, not from the app | ✅ |
| V2C-05 | A user can rename and tombstone their own rows | ✅ |
| V2C-06 | The database refuses an empty title too | ✅ |
| V2C-07 | ⭐ Another user sees **none** of it, in any table (3 tests) | ✅ 🔴 |
| V2C-08 | …even asking for the exact id | ✅ 🔴 |
| V2C-09 | …can't rename it | ✅ 🔴 |
| V2C-10 | …can't delete it | ✅ 🔴 |
| V2C-11 | …can't plant a row in someone else's account | ✅ 🔴 |
| V2C-12 | …can't tick a habit that isn't theirs | ✅ 🔴 |
| V2C-13 | …can't move their own row into someone else's account | ✅ 🔴 |
| V2C-14 | Reusing someone's habit id makes a separate row, not a takeover | ✅ 🔴 |
| V2C-15 | Deleting an account removes every row it owned | ✅ 🔴 |

### Proving these tests work

I opened a real hole in the rules, rebuilt the database, and ran the tests, one hole at a time.

| Hole opened | Tests that failed |
|---|---|
| Row Level Security switched off on `habits` | 7 |
| Anyone signed in may read every habit | 3 (V2C-07, 08, 14) |
| Signed-out visitors not explicitly blocked | 3 (V2C-01 ×3) |
| Ids unique across all users instead of per user | 2 (V2C-12, 14) |
| Deleting an account leaves its rows behind | 1 (V2C-15) |
| Updates may write any `user_id` **and** anyone may read | 4, including V2C-13 |

**Two results worth understanding:**

- **Removing the update rule's `with check` opened no hole.** When an update rule has no `with check`,
  Postgres reuses its `using` condition for the new row. The "hole" was equivalent to the original.
- **Setting `with check (true)` still didn't let V2C-13 through.** Moving a row to another account is
  also blocked by the *read* rule, because Postgres checks the updated row against it too. Only breaking
  both rules at once made V2C-13 fail. It's guarded twice, which is good.

---

## 3. Signing in: `e2e/account.spec.ts`

Real emails, sent by the local Supabase and caught by its mail catcher, so the code and link these tests
use are exactly what a person would find in their inbox. Each runs as an Android phone and as desktop.

| ID | What it proves | Result |
|---|---|:---:|
| V2C-20 | The account button opens the form; Escape closes it and returns focus | ✅ |
| V2C-21 | ⭐ Signing in with the **code**, and staying signed in after a reload | ✅ 🔴 |
| V2C-22 | Signing in with the **link** | ✅ 🔴 |
| V2C-23 | ⭐ The link works **in a different browser** from the one that asked | ✅ 🔴 |
| V2C-24 | A wrong code is refused clearly; the right one still works | ✅ |
| V2C-25 | An already-used link explains itself and leads back to the app | ✅ 🔴 |
| V2C-26 | A link with no token says so, instead of spinning forever | ✅ |
| V2C-27 | A new code replaces the old one; the old one is refused | ✅ |
| V2C-28 | Signing out, and staying signed out after a reload | ✅ 🔴 |
| V2C-29 | ⭐ Signing in and out leaves the habits on the device **byte-for-byte** unchanged | ✅ 🔴 |
| V2C-30 | The whole flow keeps the console clean | ✅ 🔴 |
| V2C-31 | At 375px the popup fits on screen, with 44px targets | ✅ 🔴 |
| V2C-35 | The header's tagline still fits on one line at 375px | ✅ 🔴 |
| V2C-32 | *(unit)* No Supabase settings → no account button at all | ✅ 🔴 |
| V2C-33 | *(unit)* ⭐ A one-time link is checked **exactly once**, even under StrictMode | ✅ 🔴 |
| V2C-34 | *(unit)* A failed link shows the reason and a way back | ✅ |

All 37 Block A browser tests and 7 Block B ones still pass, with the account button present.

### Proving these tests work

| Guard broken | Caught by |
|---|---|
| The sign-in email no longer points at `/auth/confirm` | V2C-22, 23, 25, 30 |
| Sign-out does nothing | V2C-28, 29, 30 |
| The popup anchored to the button instead of the header | V2C-31 |
| The account button shows even without Supabase settings | V2C-32 |
| The link page may check a token twice | V2C-33 |
| The old two-line header layout put back | V2C-35 |

---

## 4. Found and fixed during this block

| What | How it was found |
|---|---|
| **The popup hung 107px off the left edge of a phone screen.** It was anchored to the account button, which has the theme toggle to its right | V2C-31 |
| **The tagline was squeezed onto two lines** ("Lots of / love.") by the new button | **A screenshot, not a test.** V2C-35 now guards it |
| The code field's placeholder "123456" looked like a real code | Screenshot |
| Red error text would have been ~2.6:1 on the dark card | Checked before shipping; errors use normal text with a coral bar |
| **A test mistake:** Next adds its own hidden `role="alert"` for screen readers, so "find the alert" matched two elements | Test failure; tests now pick alerts by their text |
| **A test timing mistake:** sending an email took 6.1–6.4s under full-suite load, past the 5s wait | Auth server logs confirmed the sends succeeded; that one step now waits up to 20s |

### One thing not explained

In one full run, the database tests' **setup** failed while inserting the first rows, so all 19 were
reported as skipped (and the run as failed, so nothing slipped through). It didn't happen again in 8
standalone runs or the next 2 full runs. The setup now reports the exact database error, so if it recurs
it can be diagnosed properly rather than guessed at.

---

## 5. Not automated

| Check | Why |
|---|---|
| A real email arriving in **your** Gmail | Tests use the local mail catcher. Needs the hosted project (section 6) |
| Typing the code into the **installed** Android app | Needs your phone |
| How the email looks in Gmail | Email clients render HTML differently |

---

## 6. Connecting the real project (your steps)

The code is ready; the hosted project just needs setting up. Dashboard labels may be worded slightly
differently from these.

1. **Create the project.** Supabase dashboard → your organisation → **New project**. Name `habibit`,
   region **Southeast Asia (Singapore)**. Save the database password in a password manager.
2. **Create the tables.** In a terminal in the `habibit` folder:
   ```bash
   npx supabase login
   npx supabase link
   npx supabase db push
   ```
   `link` asks you to pick the project and type the database password. `db push` applies
   `supabase/migrations`, including every security rule above.
3. **Allow the sign-in link.** Authentication → **URL Configuration**. Site URL
   `https://habibit.vercel.app`; add redirect URLs `https://habibit.vercel.app/auth/confirm` and
   `http://localhost:3000/auth/confirm`.
4. **Use Habibit's email.** Authentication → **Email Templates**. For both **Confirm signup** and
   **Magic Link**: subject `Your Habibit sign-in code`, body = the contents of
   `supabase/templates/sign-in.html`.
5. **Get the two public values.** Project Settings → **API Keys**: the **Project URL** and the
   **Publishable key**. Never the secret key.
6. **Try it locally.** Create `habibit/.env.local` (git ignores it):
   ```bash
   NEXT_PUBLIC_SUPABASE_URL=https://your-project-ref.supabase.co
   NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=sb_publishable_...
   ```
   then `npm run dev` and sign in with your own email.
7. **Turn it on for the live app** when ready: Vercel → habibit → Settings → **Environment Variables**,
   add the same two, then redeploy. Until then the live app has no account button.

**Before other people sign in:** Supabase's built-in email sender is for testing and allows only a
handful of emails per hour. Real users need your own email provider (Authentication → SMTP Settings).

---

## 7. What changed

| File | Purpose |
|---|---|
| `supabase/migrations/20260917000000_accounts.sql` | Tables mirroring `lib/types.ts`, keys, and every security rule |
| `supabase/config.toml`, `supabase/templates/sign-in.html` | Local Supabase settings and the sign-in email |
| `supabase/tests/row-level-security.test.ts`, `vitest.db.config.mts` | The database security tests |
| `lib/supabase/client.ts` | The one browser client; `null` when accounts are off |
| `lib/auth/session.ts` | Who is signed in, as a store read with `useSyncExternalStore` |
| `lib/auth/actions.ts` | Request, verify code, verify link, sign out, with person-friendly errors |
| `components/account/*` | The account button, popup and link landing page |
| `components/ui/usePopover.ts` | Popup open/close behaviour, reusable for the theme popup later |
| `app/auth/confirm/page.tsx` | Where the email link lands (static) |
| `components/layout/Header.tsx` | Account button beside the theme toggle; tagline moved below |
| `e2e/account.spec.ts`, `test-support/local-supabase.ts` | Sign-in browser tests and local Supabase lookup |
| `playwright.config.ts`, `.github/workflows/ci.yml` | Builds the test app against local Supabase; CI starts it |

### Deviations from the plan

| Plan said | Actually | Why |
|---|---|---|
| `@supabase/ssr` with an auth callback route | Plain `supabase-js` in the browser, and a static confirm page | Nothing reads user data on the server, so cookies and a server session would add moving parts for no gain |
| "Reusing the `⋯` pattern" for the account entry | A button that opens a popup | A sign-in form doesn't fit in a row menu. The popup behaviour is its own hook so the theme toggle can use it later |
| — | Header layout changed: tagline moved below | The new button squeezed it onto two lines |
