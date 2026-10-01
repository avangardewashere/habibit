-- Habibit v4 Block F: deciding which habit reminders are due.
--
-- v3 Block E answered "who should be nudged?". This answers "which habit should
-- be mentioned, to whom, right now?" — and it lives in SQL for the same two
-- reasons: the question is entirely about data, and a question asked in SQL can
-- be pinned down by the same database tests that guard Row Level Security.
--
-- The sending itself — the VAPID private key, the HTTP requests, the scheduler —
-- stays in supabase/functions/send-reminders/.

-- ---------------------------------------------------------------------------
-- Remembering that this habit's reminder has gone today
-- ---------------------------------------------------------------------------

-- The date on *your* clock, as with the daily nudge. Null means never sent.
alter table public.habit_reminders
  add column last_sent_on date;

-- ---------------------------------------------------------------------------
-- Is this habit due on this day?
-- ---------------------------------------------------------------------------

/*
 * The same question `isDueOn` answers in lib/schedule.ts, asked in SQL.
 *
 * Having the rule in two languages is a real cost, and it is paid deliberately:
 * the sender must not drag every habit and every completion out of the database
 * to decide who to wake. The two are kept honest by testing this one against
 * the same cases as the TypeScript one (supabase/tests/habit-reminders-due).
 *
 * Three rules, and one default that matters:
 *
 *   daily / anything unrecognised → due. A schedule written by a *newer* build
 *   cannot be read here, and a missed reminder is a better failure than a
 *   habit that quietly stops being reminded about.
 *
 *   weekdays:0,2,4 → Monday is 0, matching the app and the day strip.
 *
 *   weekly:3 → due until three *other* days this week have been kept, so
 *   ticking it today never changes whether today counted.
 */
create function public.habit_due_on(p_user uuid, p_habit uuid, p_schedule text, p_day date)
returns boolean
language sql
stable
as $$
  select case
    when p_schedule ~ '^weekdays:[0-6](,[0-6])*$' then
      (extract(isodow from p_day)::int - 1)::text = any (string_to_array(substring(p_schedule from 10), ','))
    when p_schedule ~ '^weekly:[1-7]$' then
      (
        select count(*)
        from public.completions c
        where c.user_id = p_user
          and c.habit_id = p_habit
          and c.done
          and c.day <> p_day
          -- The Monday-to-Sunday week p_day falls in, as everywhere else.
          and c.day >= p_day - (extract(isodow from p_day)::int - 1)
          and c.day <= p_day - (extract(isodow from p_day)::int - 1) + 6
      ) < substring(p_schedule from 8)::int
    else true
  end;
$$;

-- ---------------------------------------------------------------------------
-- Which habit reminders are due
-- ---------------------------------------------------------------------------

/*
 * Every habit that asked to be mentioned at the instant `moment`.
 *
 * Due means all of these:
 *   1. this habit's reminder is on;
 *   2. the time you asked for has passed *on your clock*, and by less than two
 *      hours — a sender that was down for ten minutes still catches you, one
 *      that was down overnight doesn't wake you at breakfast;
 *   3. nothing has been sent for this habit yet on your today;
 *   4. the habit is due today by its own schedule (Mon/Wed/Fri means Mon, Wed
 *      and Fri only);
 *   5. you haven't already done it today;
 *   6. it is neither archived nor deleted.
 *
 * The daily nudge's own switch is not one of them: a habit reminder is yours to
 * have whether or not the account-wide nudge is on. The timezone row is, though
 * — it is where "your clock" is written down.
 *
 * `say_name` travels with the row because the sender needs it and must not have
 * to ask twice; `title` travels with it for the same reason, and is only ever
 * put into a notification when `say_name` is true (reminders.ts).
 */
create function public.habit_reminders_due(moment timestamptz default now())
returns table (
  user_id    uuid,
  habit_id   uuid,
  title      text,
  say_name   boolean,
  local_date date
)
language sql
stable
as $$
  with clocks as (
    select s.user_id, public.local_clock(moment, s.timezone) as local_now
    from public.reminder_settings s
  )
  select
    r.user_id,
    r.habit_id,
    h.title,
    r.say_name,
    c.local_now::date as local_date
  from public.habit_reminders r
  join clocks c
    on c.user_id = r.user_id
   and c.local_now is not null
  join public.habits h
    on h.user_id = r.user_id
   and h.id = r.habit_id
   and h.deleted_at is null
   and h.archived_at is null
  where r.enabled
    and c.local_now::time >= r.local_time
    and c.local_now::time < r.local_time + interval '2 hours'
    and (r.last_sent_on is null or r.last_sent_on < c.local_now::date)
    and public.habit_due_on(r.user_id, r.habit_id, h.schedule, c.local_now::date)
    and not exists (
      select 1
      from public.completions done
      where done.user_id = r.user_id
        and done.habit_id = r.habit_id
        and done.day = c.local_now::date
        and done.done
    );
$$;

/*
 * The same list, taken rather than looked at — `last_sent_on` is written before
 * the rows are handed over, so two overlapping runs cannot both send.
 *
 * Marking before sending is v3's choice, for v3's reason: a reminder that fails
 * and is never retried costs one nudge, while one sent twice is how an app's
 * notifications get switched off for good.
 */
create function public.claim_due_habit_reminders(moment timestamptz default now())
returns table (
  user_id    uuid,
  habit_id   uuid,
  title      text,
  say_name   boolean,
  local_date date
)
language sql
volatile
as $$
  update public.habit_reminders r
     set last_sent_on = d.local_date
    from public.habit_reminders_due(moment) d
   where r.user_id = d.user_id
     and r.habit_id = d.habit_id
  returning r.user_id, r.habit_id, d.title, d.say_name, d.local_date;
$$;

-- ---------------------------------------------------------------------------
-- The daily nudge stops counting habits that ask for themselves
-- ---------------------------------------------------------------------------

/*
 * Replaces v3's version, with one clause added: a habit with its own reminder
 * switched on is not counted by the account-wide nudge.
 *
 * Otherwise the two would talk about the same habit twice — once by name at
 * eight in the morning, and again as part of "2 habits left today" in the
 * evening. Asking to be reminded about something separately is a reasonable way
 * of saying "don't count this one in the summary". If every unfinished habit
 * has its own reminder, the nudge has nothing left to say and doesn't arrive.
 */
create or replace function public.reminders_due(moment timestamptz default now())
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
    -- v4 Block F: this habit does its own telling.
    and not exists (
      select 1
      from public.habit_reminders hr
      where hr.user_id = h.user_id
        and hr.habit_id = h.id
        and hr.enabled
    )
  group by r.user_id, r.local_date;
$$;

-- ---------------------------------------------------------------------------
-- Nobody but the sender
-- ---------------------------------------------------------------------------

revoke all on function public.habit_due_on(uuid, uuid, text, date)     from public, anon, authenticated;
revoke all on function public.habit_reminders_due(timestamptz)         from public, anon, authenticated;
revoke all on function public.claim_due_habit_reminders(timestamptz)   from public, anon, authenticated;
-- Re-stated because `create or replace` resets a function's grants.
revoke all on function public.reminders_due(timestamptz)               from public, anon, authenticated;
