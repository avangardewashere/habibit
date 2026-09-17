-- Habibit v2 Block E: "what changed since I last looked?"
--
-- Every row gets the server's own time of its last insert or update. A device
-- remembers the latest one it has seen and asks only for rows changed after it,
-- instead of downloading the whole account every time.
--
-- This deliberately uses the SERVER's clock, never a device's: `updated_at` is set
-- by whichever device made the edit, and a phone with a wrong clock would
-- otherwise make changes invisible to everyone else.

alter table public.habits      add column server_updated_at timestamptz not null default now();
alter table public.tasks       add column server_updated_at timestamptz not null default now();
alter table public.completions add column server_updated_at timestamptz not null default now();

create function public.stamp_server_time()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.server_updated_at := now();
  return new;
end;
$$;

-- Postgres runs row triggers in name order. "…_keep_latest_change" sorts before
-- "…_stamp_server_time", so a stale update is dropped first and never gets a new
-- server time — which would otherwise make every device re-download it.
create trigger habits_stamp_server_time
  before insert or update on public.habits
  for each row execute function public.stamp_server_time();

create trigger tasks_stamp_server_time
  before insert or update on public.tasks
  for each row execute function public.stamp_server_time();

create trigger completions_stamp_server_time
  before insert or update on public.completions
  for each row execute function public.stamp_server_time();

-- "My rows changed after X", in order: one index per table makes that a quick range scan.
create index habits_changed_since      on public.habits      (user_id, server_updated_at);
create index tasks_changed_since       on public.tasks       (user_id, server_updated_at);
create index completions_changed_since on public.completions (user_id, server_updated_at);
