-- Habibit v3 Block E: deciding who is due for a reminder.
--
-- This is the half of the sender that belongs in the database, and it is here
-- rather than in the sending code for two reasons: the question is entirely
-- about data ("whose time has passed, who still has something unfinished"), and
-- a question asked in SQL can be pinned down by the same database tests that
-- guard Row Level Security.
--
-- The half that is *not* here is the sending itself — the VAPID private key, the
-- HTTP requests, the scheduler. See supabase/functions/send-reminders/ and
-- supabase/cron/schedule-reminders.sql.

-- ---------------------------------------------------------------------------
-- Remembering that today's reminder has gone
-- ---------------------------------------------------------------------------

-- The date on *your* clock, not a UTC instant: "already sent today" has to mean
-- your today. Null means one has never been sent.
alter table public.reminder_settings
  add column last_sent_on date;

-- ---------------------------------------------------------------------------
-- Reading an instant on someone else's clock, safely
-- ---------------------------------------------------------------------------

/*
 * `moment at time zone zone`, or null if Postgres doesn't know that zone.
 *
 * This exists because the obvious version doesn't work. Writing
 *
 *     where s.timezone in (select name from pg_timezone_names)
 *
 * next to the conversion looks like a guard, but Postgres is free to do the
 * conversion before the filter — and a zone it doesn't recognise is an error
 * that ends the whole query. One nonsense row would have cost *everybody* their
 * reminders, quietly, from then on. (Found by V3E-47.)
 *
 * A plpgsql function with an exception block is the one construct that settles
 * this per row: the failure is caught where it happens and becomes a null.
 */
create function public.local_clock(moment timestamptz, zone text)
returns timestamp
language plpgsql
stable
as $$
begin
  return moment at time zone zone;
exception when others then
  return null;
end;
$$;

-- ---------------------------------------------------------------------------
-- Who is due
-- ---------------------------------------------------------------------------

/*
 * Everyone who should be nudged at the instant `moment`.
 *
 * Due means all four of these:
 *   1. reminders are on;
 *   2. the time you asked for has passed *on your clock*, and by less than two
 *      hours — so a sender that was down for ten minutes still catches you,
 *      and one that was down overnight doesn't wake you at breakfast;
 *   3. nothing has been sent to you yet on your today;
 *   4. you have at least one habit that is still unfinished today. Archived and
 *      deleted habits don't count — a reminder about a habit you've put away is
 *      the fastest way to have notifications switched off for good.
 *
 * It reads every user's rows, so it is deliberately unreachable by `anon` and
 * `authenticated` (the grants at the bottom). Only the sender, which runs
 * inside Supabase with the secret key, can call it.
 */
create function public.reminders_due(moment timestamptz default now())
returns table (
  user_id    uuid,
  local_date date,
  unfinished integer
)
language sql
stable
as $$
  with people as (
    select
      s.user_id,
      s.local_time,
      s.last_sent_on,
      -- The same instant, read on that person's own clock. Null when the zone
      -- is one Postgres has never heard of; see public.local_clock above.
      public.local_clock(moment, s.timezone) as local_now
    from public.reminder_settings s
    where s.enabled
  ),
  ripe as (
    select p.user_id, p.local_now::date as local_date
    from people p
    where p.local_now is not null
      and p.local_now::time >= p.local_time
      and p.local_now::time < p.local_time + interval '2 hours'
      and (p.last_sent_on is null or p.last_sent_on < p.local_now::date)
  )
  select
    r.user_id,
    r.local_date,
    count(h.id)::integer as unfinished
  from ripe r
  join public.habits h
    on h.user_id = r.user_id
   and h.deleted_at is null
   and h.archived_at is null
  left join public.completions c
    on c.user_id = h.user_id
   and c.habit_id = h.id
   and c.day = r.local_date
   and c.done
  where c.habit_id is null
  group by r.user_id, r.local_date;
$$;

-- ---------------------------------------------------------------------------
-- Claiming them
-- ---------------------------------------------------------------------------

/*
 * The same list, but taken rather than looked at: it writes `last_sent_on`
 * before returning, so a second caller in the same quarter hour gets nothing.
 *
 * Marking *before* sending is deliberate. A reminder that fails to send and is
 * never retried costs you one nudge; one that is sent twice because two runs
 * overlapped is the kind of thing that gets an app's notifications turned off.
 * Between those two, the quiet failure is the better one.
 */
create function public.claim_due_reminders(moment timestamptz default now())
returns table (
  user_id    uuid,
  local_date date,
  unfinished integer
)
language sql
volatile
as $$
  update public.reminder_settings s
     set last_sent_on = d.local_date
    from public.reminders_due(moment) d
   where s.user_id = d.user_id
  returning s.user_id, d.local_date, d.unfinished;
$$;

-- ---------------------------------------------------------------------------
-- Nobody but the sender
-- ---------------------------------------------------------------------------

-- Both functions read across every account, so the browser's two roles are
-- refused outright. `service_role` — which only ever runs inside Supabase —
-- keeps the access it has by default.
revoke all on function public.local_clock(timestamptz, text)   from public, anon, authenticated;
revoke all on function public.reminders_due(timestamptz)       from public, anon, authenticated;
revoke all on function public.claim_due_reminders(timestamptz) from public, anon, authenticated;
