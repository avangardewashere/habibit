-- Habibit v3 Block D: the two things a daily reminder needs to exist.
--
--   reminder_settings  — one row per person: whether reminders are on, what time
--                        they asked for, and which clock that time is on.
--   push_subscriptions — one row per device: where that device's browser will
--                        accept a message, and the keys to encrypt it with.
--
-- The sender itself is Block E. Nothing here sends anything; this is only what
-- the app writes when you switch reminders on.

-- ---------------------------------------------------------------------------
-- Settings
-- ---------------------------------------------------------------------------

create table public.reminder_settings (
  user_id    uuid        primary key default auth.uid() references auth.users (id) on delete cascade,
  enabled    boolean     not null default false,
  -- The time on *your* clock, never a UTC instant: "8 pm" has to stay 8 pm when
  -- you travel, and the sender works out when that is (Block E).
  local_time time        not null default '20:00',
  -- An IANA zone name, e.g. "Asia/Manila". The browser reports it.
  timezone   text        not null,
  updated_at timestamptz not null default now(),

  -- Quarter hours only, matching the app's picker. Keeps the sender's job to
  -- four checks an hour rather than sixty.
  constraint reminder_time_is_a_quarter_hour
    check (extract(minute from local_time) in (0, 15, 30, 45) and extract(second from local_time) = 0),
  -- Shape only. Whether the zone is real is the sender's business, and a bad
  -- one there means "no reminder", not a broken row.
  constraint reminder_timezone_looks_like_a_zone
    check (timezone ~ '^[A-Za-z][A-Za-z0-9_+/-]{1,63}$')
);

-- ---------------------------------------------------------------------------
-- Devices
-- ---------------------------------------------------------------------------

create table public.push_subscriptions (
  user_id    uuid        not null default auth.uid() references auth.users (id) on delete cascade,
  -- The address the browser's push service gave this device. It is a capability:
  -- anyone holding it can ask that service to wake this browser, which is why
  -- Row Level Security below never lets one account see another's.
  endpoint   text        not null,
  -- This device's public key and auth secret. A push is encrypted with them, so
  -- the push service in the middle carries something it cannot read.
  p256dh     text        not null,
  auth       text        not null,
  created_at timestamptz not null default now(),

  -- Per user, not globally: the same browser signed into two accounts is two
  -- devices, each getting only its own account's reminders.
  primary key (user_id, endpoint),
  constraint push_endpoint_is_an_https_url
    check (endpoint ~ '^https://' and char_length(endpoint) between 20 and 2000)
);

-- ---------------------------------------------------------------------------
-- Row Level Security — the same shape as habits, tasks and completions
-- ---------------------------------------------------------------------------

alter table public.reminder_settings  enable row level security;
alter table public.push_subscriptions enable row level security;

revoke all on public.reminder_settings, public.push_subscriptions from anon;

create policy "Own reminder settings: read"   on public.reminder_settings for select to authenticated using ((select auth.uid()) = user_id);
create policy "Own reminder settings: add"    on public.reminder_settings for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "Own reminder settings: change" on public.reminder_settings for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "Own reminder settings: remove" on public.reminder_settings for delete to authenticated using ((select auth.uid()) = user_id);

create policy "Own devices: read"   on public.push_subscriptions for select to authenticated using ((select auth.uid()) = user_id);
create policy "Own devices: add"    on public.push_subscriptions for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "Own devices: change" on public.push_subscriptions for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "Own devices: remove" on public.push_subscriptions for delete to authenticated using ((select auth.uid()) = user_id);
