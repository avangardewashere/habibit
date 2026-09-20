# Habibit: v3 Block F, delete my account

**Block:** F of 7 (v3) · **Date:** 2026-09-23 · **Status:** ⏳ green locally, CI running

> **A way out.** In the account popup, under *Sign out*: **Delete account**. It removes your
> account and everything synced to it, and leaves the habits on this device exactly where they are.
>
> This is the only thing in Habibit that cannot be undone by doing it again, which is what shapes
> every decision below.

**Legend:** ✅ pass · 🔴 **proven**: shown to fail when the guard was deliberately broken

---

## The one design decision worth arguing about

`delete_my_account()` **takes no arguments.**

The obvious shape is `delete_account(id)` — the app knows who you are, so it passes your id. That
version then needs a check that the id belongs to the caller. And a check that has to be *written*
is a check that can be forgotten, reordered, or dropped by a later edit that looked harmless.

Taking no arguments means there is nothing to tamper with. The only id the function can ever see is
the one inside the caller's own signed token, which the database reads for itself. V3F-44 is the
test for this, and it is a strange-looking test: it tries to pass someone else's id and expects the
database to say it has never heard of such a call.

**It is `security definer`**, because `auth.users` belongs to the auth system and a signed-in person
cannot delete from it — nor should they be able to, in general. That makes it the most dangerous
kind of function in the database, so it also carries `set search_path = ''` (without it, a caller
could put their own `auth.uid()` earlier in the search path and have the function call *that*), and
`anon` cannot call it at all.

---

## What goes, and what stays

| | |
|---|---|
| **Goes** | The account, your synced habits, tasks and completions, your reminder setting, and every device registered for reminders |
| **Stays** | The copy on this device. The app keeps working, signed out, exactly as it did before you made an account |

Everything Habibit stores hangs off one row in `auth.users` by `on delete cascade`, so this is a
single delete rather than a list of deletes someone has to keep up to date. V3F-40 checks all five
tables are empty afterwards — and it would notice if a future table were added without a cascade,
because that delete would fail outright.

**The sentence about what stays is not decoration.** Read plainly, "deletes everything synced to
your account" sounds like it includes the habits on your phone. It doesn't, and V3F-12 exists to
keep that sentence on the screen.

---

## Why signing out afterwards is part of the job

The token in this browser keeps working until it expires. Leaving it in place would give you an app
that looks signed in to an account that no longer exists — syncing to nothing, showing a status it
can't back up.

So the token is dropped afterwards, **and dropping it can't fail the operation** (V3F-06). By that
point the account is genuinely gone; a rejection there would escape into the effect that called it
and show you nothing at all. That is the exact shape of the bug CI found in Block D, and it is
written down in the code so the next person doesn't have to rediscover it.

The mirror case matters too: if the database says there was nobody to delete — a stale token,
because the account went from another device — the app signs out and says so, rather than reporting
a success that didn't happen (V3F-05).

---

## Tests

### The app (`npm test`)

| ID | What it proves | Result |
|---|---|---|
| V3F-01 | ⭐ Asks the database to delete the caller, naming nobody | ✅ 🔴 |
| V3F-02 | ⭐ Signs this device out afterwards | ✅ 🔴 |
| V3F-03 | ⭐ A refused delete is reported, and nothing is signed out | ✅ 🔴 |
| V3F-04 | ⭐ No connection is said plainly, not as a mystery | ✅ 🔴 |
| V3F-05 | ⭐ "Nobody to delete" signs out rather than pretending | ✅ 🔴 |
| V3F-06 | ⭐ A sign-out that throws does not turn a finished delete into a failure | ✅ 🔴 |
| V3F-07 | A build with no account settings says so instead of trying | ✅ |
| V3F-10 | ⭐ One tap never deletes anything | ✅ 🔴 |
| V3F-11 | ⭐ Says what goes, and that it can't be undone | ✅ 🔴 |
| V3F-12 | ⭐ Says what stays — the part people are afraid of | ✅ 🔴 |
| V3F-13 | ⭐ Backing out deletes nothing and puts everything back | ✅ 🔴 |
| V3F-14 | ⭐ Confirming deletes, rather than signing out and wiping the device | ✅ 🔴 |
| V3F-15 | ⭐ A delete that failed says so, and stays where you can try again | ✅ 🔴 |
| V3F-16 | The button is busy while it works, so it can't be tapped twice | ✅ 🔴 |
| V3F-17 | ⭐ Signed out, there is nothing to delete | ✅ |
| V3F-18 | The way out is quieter than the way in | ✅ |

### The database (`npm run test:db`, against a real Postgres)

| ID | What it proves | Result |
|---|---|---|
| V3F-40 | ⭐ Takes every table with it, and the account itself | ✅ 🔴 |
| V3F-41 | ⭐ Leaves everyone else exactly as they were | ✅ 🔴 |
| V3F-42 | ⭐ A signed-out visitor cannot call it at all | ✅ 🔴 |
| V3F-43 | ⭐ Deleting twice is not an error, and deletes nothing the second time | ✅ 🔴 |
| V3F-44 | ⭐ The function takes no arguments, so no id can be offered | ✅ 🔴 |
| V3F-45 | A deleted account's token can no longer read anything | ✅ |

### In a real browser (`npm run e2e`)

| ID | What it proves | Result |
|---|---|---|
| V3F-50 | ⭐ Deleting empties the account and leaves this device's habits alone | ⏳ |
| V3F-51 | ⭐ The habits survive a reload, so they really are on the device | ⏳ |
| V3F-52 | ⭐ Backing out changes nothing at all | ⏳ |

---

## Mutation checks

Every guard was broken on purpose — the TypeScript in the working copy, the SQL against the real
local database — the tests run, and the original restored before the next one started. **Fifteen
mutants, fifteen caught.**

### In the app

| Broken on purpose | Caught by |
|---|---|
| The device is not signed out after deleting | V3F-02 |
| A refused delete signs you out anyway | V3F-03 |
| "Nobody to delete" is treated as success | V3F-05 |
| A sign-out that throws escapes | V3F-06 |
| The app names an account in the call | V3F-01 |
| One tap deletes, with no confirm | V3F-10, V3F-11, V3F-12, V3F-13, V3F-14, V3F-15 |
| Confirming signs out and wipes the device instead | V3F-14, V3F-15 |
| The "stays on this device" sentence is removed | V3F-12 |
| A failed delete is silently forgotten | V3F-15 |
| The button is tappable while it works | V3F-16 |

### In the database

| Broken on purpose | Caught by |
|---|---|
| The delete is not limited to the caller | V3F-41 |
| The function takes an id and uses it | V3F-44 |
| `anon` may call it | V3F-42 |
| `security definer` is dropped | V3F-40 |
| A table loses its cascade | V3F-40 |

**The first two are the ones that matter.** "Deletes everyone, not just the caller" is the worst
thing this code could do, and "takes an id and uses it" is the shape the obvious implementation
would have had. Both go red, which is the only reason to believe the real versions are right.

One of these needed a second run. In the batch, the "takes an id" mutant reported *no tests ran* —
a worker that failed to start, not a surviving mutant. Run on its own it turns V3F-44 red with
`expected null not to be null`: the call that should have been refused succeeded. **A mutant that
doesn't produce a failure is not the same as a mutant that survived**, and the difference is only
visible if you read past the summary line.

---

## Known limits

- **`set search_path = ''` has no mutant.** Removing it doesn't break anything on its own — it only
  matters in the presence of an attacker who can create functions in a schema on the search path,
  which a signed-in Habibit user cannot. It is there because the cost is one line and the failure
  mode is severe, not because a test drove it.
- **Other devices find out on their next sync**, not immediately. A phone in a pocket will keep
  showing its own copy until it next tries the account and is told there isn't one.
- **There is no export first.** Nothing is offered to download before deleting, because the copy on
  this device *is* the export: it stays, and keeps working.
- **No cooling-off period.** The delete happens when you confirm it.

---

## Totals

| Suite | Count | Result |
|---|---|---|
| Unit (Vitest) | 368 | ✅ |
| Database | 64 | ✅ |
| Browser (Playwright) | 200 runs | ⏳ |

---

## Your steps

1. **The live database needs the new function** before this reaches habibit.vercel.app:
   ```
   npx supabase db push
   ```

### Optional check, yours

Make a throwaway account on your phone, add a habit, sign in on desktop and watch it arrive, then
delete the account from the phone. The desktop should stop syncing and fall back to its own copy,
and the phone should still show the habit, signed out.
