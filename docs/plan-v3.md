# Habibit v3: Finish and go live

**Goal:** the app is finished enough that a stranger could use it. That means reminders to
come back, a way to look back, a list you can arrange, a way to leave, and email that actually
arrives. v3 ends with the public launch, not before it.

## Decisions locked

| Decision | Choice |
|---|---|
| Features | **Reminders, weekly review, reorder & archive**, plus the theme popup from `docs/backlog.md` |
| Reminders | **One daily nudge** at a time you pick, sent **only if something is unfinished** |
| Review | **The last 4 weeks** per habit: a 28-day calendar, days kept, best streak |
| Before launch | **Delete my account**, custom email (SMTP), production settings on Vercel and Supabase |
| Launch | **At the end of v3.** Nobody else is asked to use the app before Block G |
| Not in v3 | Undo (the two-tap delete confirm stays), a reminder per habit, history older than 4 weeks |

Sign-off works as in v2: each block ends with a report in `docs/qa/`, rows are automated tests,
each new guard is shown to go red when broken, and the few things only a real phone can prove go in
an *optional checks* list, never marked passed on your behalf.

## Seven blocks

| Block | Delivers | Size |
|---|---|---|
| **A: Theme popup** | The three header buttons become one icon with a menu | Small |
| **B: Reorder & archive** | Your own habit order; hide a habit without losing its history | Medium |
| **C: Weekly review** | A 4-week look back per habit | Medium |
| **D: Reminders, part 1** | Turn reminders on, pick a time, the phone is registered | Medium |
| **E: Reminders, part 2** | The server actually sends them | Large |
| **F: Delete my account** | Leave, and take your data with you | Small |
| **G: Go live** | Real email, production settings, the launch checklist | Mostly setup |

The order is deliberate. The small, familiar blocks come first. Reminders are split in two
because the second half is a new kind of code (a job that runs on a server with nobody watching).
Account deletion comes **after** reminders so its tests also prove that a deleted account's
notification subscriptions go with it.

---

## Block A: Theme popup

*No new behaviour. The header gets tidier.*

`docs/backlog.md` explains the catch. `ThemeToggle` does two jobs: it draws the buttons, **and**
on every page load it syncs the status-bar colour. If the buttons move into a menu that only exists
while it's open, the second job stops running and the status bar goes stale.

1. **Split first, as its own commit.** Move the status-bar effect into an always-mounted
   `ThemeEffect` next to the providers. Nothing visible changes, and the existing theme tests must
   stay green. That's the proof the split is safe.
2. Then replace the three buttons with one icon (it shows the current choice) that opens a small
   menu: Light, Dark, System. It reuses `usePopover`, the same pattern as the account popup.

**Tests:** the status bar still follows the theme when the menu has never been opened (the bug
this avoids); the menu opens, picks, and closes; Escape and tapping outside close it; the header
has no sideways scroll at 375px.

---

## Block B: Reorder & archive

**Reorder.** Habits get a `position`. It's stored as a sortable piece of text rather than a
number 1, 2, 3, so moving one habit changes **only that habit's row**. With plain numbers, moving
the last habit to the top would renumber every habit. Two devices reordering at once would then
fight over every row, and "latest change wins" would mix their orders together. With a sortable
text key, each device's move touches one row and the result is always a sensible order.

- Drag by a handle on each row. **Read first:** check that the drag library we pick works with
  React 19 and on touch. If none does cleanly, the fallback is **Move up / Move down** in the
  existing `⋯` menu. That menu version is built either way, for keyboard users.
- A database migration adds `position` to `habits`, sync carries it, and existing habits get
  positions in their current order, so nobody's list jumps around after the update.

**Archive.** The data model has had `archivedAt` since v0, and the selectors already hide archived
habits. This block adds the controls: **Archive** in the `⋯` menu, an "Archived (2)" line at the
bottom of the habits section that opens the list, and **Unarchive** there. An archived habit keeps
its whole history. Unarchive it and its streak is still there.

**Tests:** the order key always sorts between its neighbours (thousands of random moves, the order
never breaks); moving a habit changes one row; two devices reordering end in a valid order; the
order survives reload and sync; archive hides it, unarchive restores it with its streak intact.

---

## Block C: Weekly review

A **Review** button opens a full-screen sheet, not a new page. That's a deliberate choice: the
service worker from v2 Block F caches the one page the app has, so a sheet works offline for free.
A separate page would need its own offline handling.

For each active habit:

- a **28-day calendar**, four rows of seven, weeks starting Monday to match the day strip, today
  marked;
- **kept 19 of 28** and **best streak** within those four weeks;
- days before the habit existed show as blank, not as misses. Otherwise a habit added last week
  would look like a failure.

It is all read from data you already have. There are no database changes. Past days stay tappable
only in the 7-day strip; the review is for looking, not editing, so a misplaced thumb can't change
your history.

**Tests:** the 28 days are right across a month end, a year end and a daylight-saving change
(the same noon-anchored arithmetic as the 7-day strip); "before it existed" days are blank; best
streak on runs that start before the window; the sheet opens, scrolls, closes, and works offline.

---

## Block D: Reminders, part 1 (opt in)

**Read first:** Next's PWA guide (`node_modules/next/dist/docs/01-app/02-guides/progressive-web-apps.md`)
covers web push. Its example sends from a Server Action, but ours are sent by a scheduled job
(Block E), so only the subscribe half applies here.

- In the account popup: **Daily reminder: off / 8:00 pm**, with the time in 15-minute steps.
  Reminders need an account, because the server has to know what you haven't finished yet.
- Turning it on asks the browser for notification permission, then saves a **push subscription**
  (an address the browser gives us for sending to this device) in a new `push_subscriptions`
  table. It also saves your time and **time zone** in `reminder_settings`. Both tables use the same
  "you can only see your own rows" rules as habits.
- One reminder time per account, one subscription per device. Phone and desktop can both receive.
- The service worker learns two new events: `push` (show the notification) and
  `notificationclick` (open or focus the app).
- A **VAPID key pair** is created: the public half is fine in the app; the private half goes only
  to the server that sends (Block E), never into the app.

**Tests:** database tests that nobody can read or write another person's subscription or settings;
unit tests for the popup states (not signed in, permission blocked, on, off); a browser test that
sends a fake push event to the service worker and sees a notification appear and clicking it open
the app.

---

## Block E: Reminders, part 2 (sending)

The new idea in this block: **code that runs with nobody using the app.**

- **Who is due** is decided by one database function, so the logic sits where the data is and the
  existing database tests can pin it down. It returns everyone whose reminder time, **in their own
  time zone**, has just passed, who has at least one habit not done today, and who hasn't already
  been sent one today.
- **Every 15 minutes**, Supabase's scheduler (`pg_cron`) calls a small **Supabase Edge Function**.
  The function asks who is due and sends each one a push using the private VAPID key.
  - Why not Vercel's scheduler: on the free plan it runs at most once a day, and it would need the
    Supabase secret key inside the Vercel app, which we've kept out on purpose. The Edge Function
    runs inside Supabase, next to the data, so that key never leaves Supabase.
- Subscriptions the browser has thrown away (the push service answers "gone") are deleted, so we
  stop sending to dead addresses.
- **Read first:** the web-push library has to run in Supabase's Deno runtime. Check which one does
  before writing anything.

**Tests (database):** due at 20:00 in Manila but not yet in London; nothing sent if every habit is
done; never twice in one day; archived and deleted habits don't count as unfinished; a daylight-
saving day neither skips nor doubles. **Tests (function):** it sends to each due device, removes a
"gone" subscription, and one failed device doesn't stop the rest.

**Optional check, yours:** set a reminder two minutes ahead, lock your Android phone, and see it
arrive.

---

## Block F: Delete my account

Every table already has `on delete cascade` back to the user, so deleting the account row removes
their habits, tasks, completions, subscriptions and settings in one step. The work is doing it
safely:

- A database function, `delete_my_account()`, deletes **only the caller**. It never takes an id as
  input, so there's nothing to tamper with.
- In the account popup: **Delete account**, then a confirm that says exactly what goes (your
  account and synced data). It also says what doesn't: the copy on this device stays, so you can
  keep using the app signed out.
- Afterwards you're signed out on this device, and the other devices find out on their next sync.

**Tests:** after deleting, none of that user's rows remain in any table; another user's data is
untouched; calling it signed out does nothing; the popup flow shows the right wording and signs you
out.

---

## Block G: Go live

Mostly setup, and **most of it is yours to do**. I'll write each step out, and you do anything
that involves an account or a password.

1. **Custom email (SMTP).** Supabase's built-in sender allows only a few sign-in emails an hour.
   You create an account with an email service (Resend's free tier is the usual pick for
   Supabase) and paste its settings into Supabase.
2. **Production settings.** Push the v3 migrations to the live database. In Supabase, set the Site
   URL and redirect URLs to `habibit.vercel.app`. In Vercel, add the Supabase and VAPID public
   keys. Deploy the Edge Function and turn on the schedule.
3. **A short privacy page:** what's stored, where, and how to delete it. Once strangers can make
   accounts, this should exist.
4. **A production smoke test:** a small Playwright run against the live site that checks it opens,
   installs, and works offline, without creating accounts.
5. **The launch checklist** in `docs/qa/v3-g-launch.md`: every item ticked by you or by a test,
   then v3 is done.

**Doing step 2 early is fine.** The Vercel variables are the only thing stopping the live app from
showing the account button today. Add them at any point if you want to try sync on your own phone
before v3 finishes.
