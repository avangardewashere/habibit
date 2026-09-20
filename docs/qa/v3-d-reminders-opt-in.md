# Habibit: v3 Block D, reminders — turning them on

**Block:** D of 7 (v3) · **Date:** 2026-09-21 · **Status:** ⏳ green locally, browser and database tests running on CI

> **The switch exists.** In the account popup: *Daily reminder — Turn on*, then a time. Turning it
> on asks your browser for permission and registers this device with your account.
>
> **Nothing is sent yet.** The server that actually wakes your phone is Block E. This block is the
> half that has to exist first, and it can be checked on its own.

**Legend:** ✅ pass · 🔴 **proven**: shown to fail when the guard was deliberately broken · ⏳ waiting on CI

---

## Your decisions, from the plan

| Question | Your choice |
|---|---|
| How reminders work | **One daily nudge** at a time you pick, and only if something is unfinished |
| Time granularity | Quarter hours, so the sender wakes four times an hour rather than sixty |

---

## What I read first

Next's PWA guide (`node_modules/next/dist/docs/01-app/02-guides/progressive-web-apps.md`) covers web
push end to end. Its example sends from a Server Action; ours is sent by a scheduled job inside
Supabase (Block E), so only the subscribing half applies. What I took from it: the exact shape of
`pushManager.subscribe`, the conversion of the key from text to bytes, and the two service worker
events (`push`, `notificationclick`).

---

## How it fits together

| Piece | Where | What it holds |
|---|---|---|
| Your setting | `reminder_settings` (one row per person) | on/off, the time on your clock, your timezone |
| Each device | `push_subscriptions` (one row per device) | where to reach that browser, and the keys to encrypt with |
| The switch | `components/account/ReminderSettings.tsx` | asks permission, registers, saves |
| Showing one | `public/sw.js` | `push` shows a notification, `notificationclick` opens the app |

**Why your timezone is stored.** You ask for "8 pm". The server has to turn that into an instant,
and "8 pm" is a different moment in Manila and in London. The browser reports its zone and it is
saved beside the time, so the sender can work out when your 8 pm is (Block E's job).

**Why reminders need an account.** The sender has to know what you haven't finished before deciding
whether to bother you. Signed out, nothing about your habits leaves the device, so there is nothing
for a server to check — the section simply isn't there.

**A device is registered per account.** The same browser signed into two accounts is two rows, each
getting only its own account's reminders. Signing out unregisters that device.

---

## About the keys

Push uses a **VAPID key pair**. The public half identifies Habibit to the browser's push service and
is shipped in the app, like the Supabase publishable key. **The private half never enters this
repo, this app, or Vercel** — it goes into Supabase's secrets in Block E, where the sender lives.

The browser tests need *a* public key to render the section at all, so `playwright.config.ts`
carries a throwaway one. Its private half was generated with it and discarded: nothing in this repo
can send a push to anyone.

A build with no key has no reminders at all, and says nothing about them — the same way a build with
no Supabase settings has no account button (V3D-34).

---

## What it says when it can't

| Situation | What you see |
|---|---|
| Browser can't do push at all | "This browser can't show reminders." |
| You blocked notifications | "Notifications are blocked for Habibit. Your browser's settings for this site can turn them back on." |
| You dismissed the prompt | "Notifications need your permission. Tap again when you're ready." |
| Registered, but couldn't be saved | "Couldn't save your reminder…" — **and the switch stays off** (V3D-39) |

That last one matters: the browser can say yes while the account is unreachable. Showing "on" there
would promise a reminder that no server knows about.

---

## Tests

| ID | What it proves | Test | Result |
|---|---|---|---|
| V3D-01…05 | Quarter-hour times: 96 of them, in order; what Postgres returns is read back; "8:00 pm" | `lib/reminders/times.test.ts` | ✅ |
| V3D-10 | ⭐ Asks permission, subscribes, reports the address and keys | `lib/reminders/push.test.ts` | ✅ 🔴 |
| V3D-11 | ⭐ A blocked browser is reported as blocked, and nothing is asked | same | ✅ 🔴 |
| V3D-12 | A dismissed prompt is not a refusal: it can be asked again | same | ✅ 🔴 |
| V3D-13 | Reuses the address this device already has | same | ✅ |
| V3D-14 | A push service that refuses is a failure, not a crash | same | ✅ |
| V3D-15 | A build with no key has no reminders | same | ✅ 🔴 |
| V3D-16 | Turning off hands the address back to the browser | same | ✅ |
| V3D-20 | ⭐ The worker shows what the sender wrote, under one tag | `lib/offline/sw-push.test.ts` | ✅ 🔴 |
| V3D-21 | ⭐ An unreadable or empty push still shows something (browsers require it) | same | ✅ 🔴 |
| V3D-22…24 | ⭐ Tapping brings the app forward, opens it if closed, sends another page home | same | ✅ 🔴 |
| V3D-30…39 | The switch: off state, turning on, turning off, changing the time, and every refusal | `components/account/ReminderSettings.test.tsx` | ✅ 🔴 |
| V3D-40 | ⭐ A signed-out visitor cannot read or write either table | `supabase/tests/reminders.test.ts` | ⏳ |
| V3D-41 | ⭐ One person cannot see another's devices or settings | same | ⏳ |
| V3D-42 | ⭐ One person cannot delete another's device, even knowing its address | same | ⏳ |
| V3D-43 | The row belongs to whoever is signed in, whatever the app sends | same | ⏳ |
| V3D-44 | A reminder time has to be a quarter hour | same | ⏳ |
| V3D-45 | A device address has to be an https URL | same | ⏳ |
| V3D-46 | The same device registering again updates its keys rather than duplicating | same | ⏳ |
| V3D-47 | Deleting the account takes its reminders with it | same | ⏳ |
| V3D-50 | ⭐ In a real browser: signed in, the popup offers a reminder, off to begin with | `e2e/reminders.spec.ts` | ⏳ |
| V3D-51 | ⭐ Signed out, there is no reminder to set | same | ⏳ |

**The service worker's push rules are tested directly.** `public/sw.js` can't be imported — it isn't
a module — so the test reads the real file and runs it against a stand-in for the worker, then fires
`push` and `notificationclick` at it. That's how those five guards can be broken and seen to fail
without a real push service.

---

## Mutation checks

Each guard was broken on purpose, the tests run, and the file restored before the next run started.

| Broken on purpose | Caught by |
|---|---|
| A blocked browser is asked anyway | V3D-11 |
| A dismissed prompt counts as a yes | V3D-12 |
| `userVisibleOnly` dropped from the subscription | V3D-10 |
| A build with no key subscribes anyway | V3D-15 |
| The worker shows nothing when a push is unreadable | V3D-21 |
| Every reminder stacks its own notification instead of replacing | V3D-20 |
| Tapping always opens a second window | V3D-22, V3D-24 |
| Turning off leaves the device registered | V3D-35 |
| A failed save is shown as success | **V3D-39 — added after this mutant survived** |

That last row is the honest one: my first nine tests all passed with the failure path broken. The
test came from the mutant, not the other way round.

---

## Known limits

- **Nothing sends yet.** Turning it on registers this device and saves the time; Block E is the part
  that wakes your phone. Until then, switching it on does nothing visible after the switch.
- **A real subscription can't be completed in the browser tests.** It needs a real push service and
  a private key, which this repo does not have. The registering logic is covered by unit tests with
  the browser's push API stood in for; the real thing is checked on your phone in Block E.
- **No per-habit reminder times.** One time per account, as you chose.
- **Desktop Safari can't do web push this way** and says so. Android Chrome, desktop Chrome, Edge and
  Firefox can.

---

## Totals

| Suite | Count | Result |
|---|---|---|
| Unit (Vitest) | 333 | ✅ |
| Browser (Playwright), 96 tests × 2 devices | 192 runs | ⏳ |
| Database | 42 | ⏳ |

---

## Your steps

1. **To see the switch locally**, your `.env.local` needs a VAPID public key. Generate a pair with
   `npx web-push generate-vapid-keys`, put the **public** half in `.env.local` as
   `NEXT_PUBLIC_VAPID_PUBLIC_KEY`, and keep the private half somewhere safe — Block E needs it in
   Supabase's secrets. Don't paste the private half into this repo, or to me.
2. **Your local database needs the new tables**: `npx supabase migration up`.
3. **The live database needs them too**, before this reaches habibit.vercel.app: `npx supabase db push`.
