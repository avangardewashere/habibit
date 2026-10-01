-- Habibit v4 Block E: a reminder for one habit, at its own time.
--
-- The account-wide nudge from v3 (reminder_settings) stays exactly as it is.
-- This is *as well as* that: "remind me to take my medication at 8am", on top
-- of "nudge me at 8pm if anything is left".
--
-- The clock these times are on is the person's, and it already lives in
-- reminder_settings.timezone — one person is in one place at a time, so
-- repeating the zone on every habit would only create rows that disagree.
-- Sending is Block F; nothing here sends anything.

create table public.habit_reminders (
  -- Filled in from the signed-in user's token, so the app never sends it.
  user_id    uuid        not null default auth.uid() references auth.users (id) on delete cascade,
  habit_id   uuid        not null,
  -- Turning a reminder off keeps the row, so the time and the naming choice are
  -- still there when it goes back on.
  enabled    boolean     not null default true,
  -- The time on *your* clock, never a UTC instant, exactly as the daily nudge.
  local_time time        not null default '20:00',
  /*
   * Whether the notification may say which habit it is — your choice, per
   * habit, and **off by default**.
   *
   * v3 decided a notification never names the habit, because a lock screen is
   * public. A per-habit reminder that cannot say which habit is barely a
   * reminder, so this exists; the default keeps v3's promise for anyone who
   * never thinks about it, and the sender has to honour it per habit (Block F).
   */
  say_name   boolean     not null default false,
  updated_at timestamptz not null default now(),

  primary key (user_id, habit_id),
  -- Includes user_id, so a reminder can only ever point at the same user's
  -- habit — and deleting the habit takes its reminder with it.
  foreign key (user_id, habit_id) references public.habits (user_id, id) on delete cascade,

  -- Quarter hours only, matching the app's picker and the sender's wake-ups.
  constraint habit_reminder_time_is_a_quarter_hour
    check (extract(minute from local_time) in (0, 15, 30, 45) and extract(second from local_time) = 0)
);

-- The sender asks "whose reminders are due at this moment?", never "what are
-- this habit's reminders?", so the index follows the time.
create index habit_reminders_due on public.habit_reminders (local_time) where enabled;

-- ---------------------------------------------------------------------------
-- Row Level Security — the same shape as everything else
-- ---------------------------------------------------------------------------

alter table public.habit_reminders enable row level security;

revoke all on public.habit_reminders from anon;

create policy "Own habit reminders: read"   on public.habit_reminders for select to authenticated using ((select auth.uid()) = user_id);
create policy "Own habit reminders: add"    on public.habit_reminders for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "Own habit reminders: change" on public.habit_reminders for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "Own habit reminders: remove" on public.habit_reminders for delete to authenticated using ((select auth.uid()) = user_id);
