# Habibit: v3 Block E, reminders — actually sending them

**Block:** E of 7 (v3) · **Date:** 2026-09-22 · **Status:** ⏳ green locally, CI running

> **The new idea in this block: code that runs with nobody using the app.** Every line before now
> only ever ran because you tapped something. This runs at 8 o'clock whether or not anyone has
> opened Habibit for a week, and if it gets something wrong there is nobody there to see it.
>
> That shapes everything below. Nothing throws, because there is no one to catch it. Nothing sends
> twice, because the thing it would wake is your phone.

**Legend:** ✅ pass · 🔴 **proven**: shown to fail when the guard was deliberately broken

---

## The shape of it

| Piece | Where | What it does |
|---|---|---|
| Who is due | `supabase/migrations/20260922000000_reminder_sender.sql` | One SQL question: whose time has passed, who still has something left |
| The decisions | `supabase/functions/send-reminders/reminders.ts` | What the notification says, who gets it, what a failure means |
| The sending | `supabase/functions/send-reminders/index.ts` | Deno: reads the secrets, talks to the database, does the encryption |
| The alarm clock | `supabase/cron/schedule-reminders.sql` | Every quarter hour, wake the sender |

**Why the hard question is in SQL.** "Has 8 pm passed *for you*" is a question about data — your
time, your zone, your habits, your completions. Asked in SQL it can be tested against a real
Postgres by fixing an instant and asking who would be nudged then, which is the only way to prove
anything about time zones. Asked in TypeScript it would need the data fetched first, and the test
would be testing the fetch.

**Why the decisions are in a file with no imports.** `reminders.ts` ships to Deno inside Supabase;
this repo's tests run on Node. It has no imports at all, so the same file runs in both, and the
parts worth arguing about are covered by `npm test` like everything else. `index.ts` holds only the
parts that need Deno, and is kept as short as that allows.

---

## The decisions, and why

**The notification never names the habit.** It says "2 habits left today." A notification sits on a
lock screen where anyone standing near you can read it, and "Take the medication" is not ours to
put there. The count is enough to be worth a tap (V3E-02).

**Today's reminder is written down *before* it is sent, not after.** If the sending then fails you
lose one nudge; if two runs overlapped and both sent, your phone buzzes twice for the same thing.
Between a quiet miss and a double, the miss is the better failure (V3E-50).

**Late is still worth sending, up to two hours.** A sender that was down for ten minutes should
still catch you at 8:10. One that was down all night should not wake you at breakfast (V3E-46).

**A dead address is deleted; a failed one is kept.** Only the two replies that mean "this
subscription no longer exists" (404, 410) remove a device. A timeout or a 500 is a push service
having a bad minute, and losing your phone over it would be absurd (V3E-14, V3E-15, V3E-20).

**A send that throws is a failure, not the end of the run.** Everyone else still gets theirs
(V3E-12, V3E-13).

---

## ⚠️ What testing found: one nonsense row would have stopped everybody's reminders

The first version guarded the time-zone conversion like this:

```sql
select (moment at time zone s.timezone) ...
from reminder_settings s
where s.timezone in (select name from pg_timezone_names)
```

That reads like a guard and isn't one. **Postgres is free to do the conversion before the filter**,
and a zone it doesn't recognise isn't a null — it's an error that ends the whole query. One row
with a junk zone in it and *nobody* gets a reminder, from then on, silently.

The fix is a small plpgsql function with an exception block (`public.local_clock`), which is the one
construct that settles this per row: the failure is caught where it happens and becomes a null.

This is the kind of bug the block was riskiest for — the sender has nobody watching it, so "quietly
stopped working for everyone" is exactly the failure that would go unnoticed for weeks. It was
caught by V3E-47, which is only there because I wrote a test for a time zone that doesn't exist.

**And a fault in my own tests, found the same way.** V3E-43 marks every habit done and left them
done, so every test after it was asking about someone with nothing left to do — they passed while
proving nothing. Each test now starts with nothing ticked.

---

## Tests

### The sender's decisions (`npm test`)

| ID | What it proves | Result |
|---|---|---|
| V3E-01 | The count reads properly for one and for many | ✅ |
| V3E-02 | ⭐ The body is a count and fixed words — never a habit's name | ✅ 🔴 |
| V3E-10 | ⭐ Every device of everyone due gets one, and each gets their own count | ✅ 🔴 |
| V3E-11 | ⭐ Someone not due is not sent to | ✅ 🔴 |
| V3E-12 | ⭐ One failing device does not cost anyone else their reminder | ✅ 🔴 |
| V3E-13 | ⭐ A send that throws is a failure, not the end of the run | ✅ 🔴 |
| V3E-14 | ⭐ A device the push service says is gone is handed back for deleting | ✅ 🔴 |
| V3E-15 | A device that merely failed is kept | ✅ 🔴 |
| V3E-16 | Someone due with no device left is counted, not sent to | ✅ |
| V3E-17 | ⭐ The devices are attempted together, not one after another | ✅ 🔴 |
| V3E-20 | Only 404 and 410 mean "gone" | ✅ 🔴 |
| V3E-21 | ⭐ Only the secret key may run the sender — the app's own key is refused | ✅ 🔴 |
| V3E-22 | ⭐ A sender with no secret configured lets nobody in | ✅ 🔴 |

### Who is due (`npm run test:db`, against a real Postgres)

| ID | What it proves | Result |
|---|---|---|
| V3E-40 | ⭐ 8 pm in Manila is not 8 pm in London | ✅ 🔴 |
| V3E-41 | ⭐ Seven hours later it is London's turn, not Manila's | ✅ 🔴 |
| V3E-42 | ⭐ The count is what is still unfinished today | ✅ 🔴 |
| V3E-43 | ⭐ Nothing is sent when everything is done — and it returns when something is undone | ✅ 🔴 |
| V3E-44 | ⭐ A habit you archived or deleted is not something you are behind on | ✅ 🔴 |
| V3E-45 | ⭐ Reminders switched off means never due | ✅ 🔴 |
| V3E-46 | ⭐ Late is still worth sending; hours late is not; early is not | ✅ 🔴 |
| V3E-47 | ⭐ A time zone Postgres has never heard of does not stop anyone else | ✅ 🔴 |
| V3E-48 | ⭐ An hour that happens twice (clocks back) sends one reminder, not two | ✅ 🔴 |
| V3E-49 | ⭐ An hour that never happens (clocks forward) still sends one | ✅ 🔴 |
| V3E-50 | ⭐ Claiming twice in the same evening sends once | ✅ 🔴 |
| V3E-51 | ⭐ And the next evening it comes round again | ✅ 🔴 |
| V3E-52 | The date written down is the one on your clock | ✅ 🔴 |
| V3E-53 | ⭐ A signed-in person cannot ask who is due, or claim them | ✅ 🔴 |
| V3E-54 | ⭐ Nor can a signed-out visitor | ✅ |
| V3E-55 | ⭐ Nobody can touch anyone else's "already sent" date | ✅ |

---

## Mutation checks

Every guard here was broken on purpose — the TypeScript in the working copy, the SQL against the
real local database — the tests run, and the original restored before the next one started.
**Twenty-two mutants, twenty-two caught.**

### In the sender's decisions

| Broken on purpose | Caught by |
|---|---|
| The notification carries a habit's name | V3E-01, V3E-02, V3E-10 |
| Only the first device of each person is sent to | V3E-10, V3E-14 |
| Everybody gets the same count | V3E-10 |
| Everyone with a device is sent to, due or not | V3E-10, V3E-11, V3E-16 |
| One failing send ends the round | V3E-12, V3E-13, V3E-14 |
| A send that throws escapes the round | V3E-13 |
| A gone device is kept instead of deleted | V3E-14 |
| A device that merely failed is deleted | V3E-13, V3E-15 |
| The devices are sent to one after another | V3E-17 |
| Any failure counts as "gone" | V3E-20 |
| Any valid key may run the sender | V3E-21 |
| A missing secret lets everyone in | V3E-22 |

### In the database

| Broken on purpose | Caught by |
|---|---|
| `local_clock` stops catching an unknown zone | V3E-47 |
| The time zone is ignored: everyone is on the server's clock | V3E-40, V3E-41, V3E-42, V3E-43, V3E-44, V3E-46, V3E-49 |
| No upper bound on how late is too late | V3E-46 |
| Nothing remembers that today's reminder has gone | V3E-48, V3E-50 |
| One reminder ever, then never again | V3E-51 |
| "Already sent today" uses the server's date instead of yours | V3E-52 |
| Archived and deleted habits count as unfinished | V3E-44 |
| Reminders that are switched off are sent anyway | V3E-45 |
| What you have ticked today is ignored | V3E-43 |
| Unticking a habit does not bring the nudge back | V3E-43 |
| The functions are reachable from a browser | V3E-53 |

**The last one took two goes, and the second go is the interesting one.** Granting
`reminders_due` and `claim_due_reminders` to signed-in users did *not* turn V3E-53 red — it still
failed with `permission denied for function local_clock`. The test was passing because of a
different lock than the one I had picked up. Only when all three were granted did it go red.

A guard you have not seen fail is a guard you are only assuming: **and a test can pass for a reason
you did not intend.** The second-innermost lock was doing the work while I was congratulating
myself about the outer one.

V3E-54 and V3E-55 have no mutant of their own. They hold because signed-out visitors are refused
the tables outright (Block D, V3D-40) and because Row Level Security stops one person writing
another's row — both already proven elsewhere, so they are marked ✅ rather than 🔴.

---

## About the keys, again

| Key | Where it lives | Who sees it |
|---|---|---|
| VAPID **public** | the app's bundle, Vercel, `playwright.config.ts` | everyone, by design |
| VAPID **private** | Supabase secrets, and wherever you kept it | the sender only |
| Supabase **publishable** | the app's bundle | everyone, by design |
| Supabase **secret** | inside Supabase | the sender only, and never Vercel |

**Nothing in this repo can send a push to anyone.** The private half has never been in it, and the
sender reads it from Supabase's secrets at the moment it runs.

The sender also checks its caller itself (V3E-21). Supabase already refuses a caller with no valid
key — but the key the app ships in every browser *is* a valid key, so "Supabase let them in" is not
the same as "the scheduler asked". A missing secret means nobody is let in, rather than everybody
(V3E-22).

---

## Known limits

- **Nothing here has sent a real push.** A real push needs a real push service and the private key,
  neither of which this repo has. Everything up to the encryption is tested; the encryption itself
  is the `web-push` library's job, and the proof is your phone (see *your steps*).
- **The scheduler is not tested.** `supabase/cron/schedule-reminders.sql` runs once, by hand, in
  your project. CI has no scheduler and no deployed function to point one at.
- **One reminder a day, per account**, as you chose — not per habit, and not a second nudge later.
- **Turning reminders on shortly after your chosen time may nudge you straight away**, because the
  rule is "your time has passed within the last two hours and nothing has gone today". Switch it on
  at 20:30 with 8 pm chosen and you will likely get one. It proves the thing works, so it is left
  as it is.
- **If the sender is down for a whole evening, that evening's reminder is lost**, not sent late the
  next morning. That is the two-hour rule doing its job.

---

## Totals

| Suite | Count | Result |
|---|---|---|
| Unit (Vitest) | 352 | ✅ |
| Database | 58 | ✅ |
| Browser (Playwright) | 194 runs | ✅ |

---

## Your steps

These are the parts only you can do, because they involve keys and your own project.

1. **Put the new tables and functions on the live database:**
   ```
   npx supabase db push
   ```
2. **Give Supabase the VAPID pair** (the private half goes here and nowhere else — not into this
   repo, not into `.env.local`, not into Vercel, and not to me):
   ```
   npx supabase secrets set VAPID_PUBLIC_KEY=... VAPID_PRIVATE_KEY=... VAPID_SUBJECT=mailto:you@example.com
   ```
3. **Deploy the sender:**
   ```
   npx supabase functions deploy send-reminders
   ```
4. **Schedule it.** Dashboard → Integrations → Cron → new job, `*/15 * * * *`, type *Supabase Edge
   Function*, `send-reminders`, POST.

   **Check the Authorization header the form fills in.** The sender accepts only the project's
   *secret* (service role) key — the publishable one is in every browser already, so a job carrying
   that gets a 401, which the function's logs will show plainly. `supabase/cron/schedule-reminders.sql`
   is the same job written in SQL if you would rather have it in version control.

### Optional check, and the only one that proves the whole thing

Set your reminder for two or three quarter-hours ahead, leave at least one habit unticked, **lock
your Android phone**, and wait. The notification should arrive, say how many are left, and open
Habibit when tapped.

If it doesn't: Supabase → Edge Functions → `send-reminders` → Logs shows what each run did
(`{"due":1,"sent":1}`), and `select * from cron.job_run_details order by start_time desc limit 10;`
shows whether the alarm clock is ringing at all.
