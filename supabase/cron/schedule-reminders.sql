-- Habibit v3 Block E: waking the sender every quarter hour.
--
-- This file is **not a migration**, and CI never runs it. It needs two things a
-- repo must not contain: the address of your deployed function, and a key that
-- can read every account. You run it once, by hand, in your project's SQL
-- editor, after deploying the function.
--
-- ===========================================================================
-- The easy way, which needs no SQL at all
-- ===========================================================================
--
-- The Supabase dashboard has **Integrations → Cron**. Create a job:
--
--   Name     habibit-reminders
--   Schedule */15 * * * *          (every quarter hour, matching the picker)
--   Type     Supabase Edge Function → send-reminders, method POST
--
-- **Check the Authorization header it fills in.** The sender only accepts the
-- project's *secret* (service role) key, because the publishable key is one
-- every browser already has — a job carrying that one will be refused with 401,
-- which the function's logs will show. Replace it with the secret key if it
-- isn't already.
--
-- The SQL below is the same job written out, for when you want it in version
-- control or the dashboard is not an option.
--
-- ===========================================================================
-- The same thing in SQL
-- ===========================================================================

-- 1. The two extensions: a scheduler, and the ability to make an HTTP request
--    from inside the database.
create extension if not exists pg_cron;
create extension if not exists pg_net;

-- 2. Keep the key in Vault, not in this file and not in the job's definition.
--    Run this line once with your own value, then clear your editor history —
--    the service role key can read every account, and is the one key that must
--    never be pasted anywhere it can be read back.
--
--    select vault.create_secret('YOUR-SERVICE-ROLE-KEY', 'habibit_service_key');
--    select vault.create_secret('https://YOUR-PROJECT.supabase.co/functions/v1/send-reminders', 'habibit_sender_url');

-- 3. One tick: read both secrets, and post to the function. Nothing is written
--    down here — the values are looked up at the moment the job runs.
create or replace function public.send_reminders_tick()
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  sender_url text;
  service_key text;
begin
  select decrypted_secret into sender_url  from vault.decrypted_secrets where name = 'habibit_sender_url';
  select decrypted_secret into service_key from vault.decrypted_secrets where name = 'habibit_service_key';

  if sender_url is null or service_key is null then
    raise warning 'habibit: reminder sender is not configured; nothing was sent';
    return;
  end if;

  -- Fire and forget. pg_net answers immediately and does the request in the
  -- background, so a slow push service never holds up the database.
  perform net.http_post(
    url     := sender_url,
    headers := jsonb_build_object(
      'Content-Type',  'application/json',
      'Authorization', 'Bearer ' || service_key
    ),
    body    := '{}'::jsonb
  );
end;
$$;

-- Only the scheduler, which runs as the database owner, may call it.
revoke all on function public.send_reminders_tick() from public, anon, authenticated;

-- 4. Every quarter hour, on the quarter hour.
--
--    The sender does not have to be punctual: the database's own rule is "your
--    time has passed, by less than two hours, and nothing has gone today", so a
--    tick that is late or missed still catches you, and two ticks that overlap
--    still send once (supabase/migrations/20260922000000_reminder_sender.sql).
select cron.schedule('habibit-reminders', '*/15 * * * *', 'select public.send_reminders_tick()');

-- To see what it has been doing:
--   select * from cron.job_run_details where jobid = (select jobid from cron.job where jobname = 'habibit-reminders') order by start_time desc limit 20;
-- To stop it:
--   select cron.unschedule('habibit-reminders');
