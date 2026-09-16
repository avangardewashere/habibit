-- Habibit v2 Block C: the tables, mirroring lib/types.ts (schema version 2).
--
-- Every row belongs to one user, and Row Level Security makes the database itself
-- refuse to show or change anyone else's rows. That matters because the app talks
-- to the database straight from the browser with a public key: the rules have to
-- live here, where a modified browser cannot skip them.

-- ---------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------

create table public.habits (
  -- Filled in from the signed-in user's token, so the app never sends it.
  user_id     uuid        not null default auth.uid() references auth.users (id) on delete cascade,
  -- Made on the device (crypto.randomUUID), so a habit has its id before it syncs.
  id          uuid        not null,
  title       text        not null check (char_length(title) between 1 and 500),
  created_at  timestamptz not null,
  updated_at  timestamptz not null,
  archived_at timestamptz,
  deleted_at  timestamptz,
  -- Keyed per user as well as by id. Ids come from devices, so the key must not
  -- let one user's row collide with, or squat on, another user's.
  primary key (user_id, id)
);

create table public.tasks (
  user_id      uuid        not null default auth.uid() references auth.users (id) on delete cascade,
  id           uuid        not null,
  title        text        not null check (char_length(title) between 1 and 500),
  created_at   timestamptz not null,
  updated_at   timestamptz not null,
  completed_at timestamptz,
  deleted_at   timestamptz,
  primary key (user_id, id)
);

-- One row per habit per day: the `habitId::YYYY-MM-DD` key, split into columns.
create table public.completions (
  user_id    uuid        not null default auth.uid() references auth.users (id) on delete cascade,
  habit_id   uuid        not null,
  -- The user's local calendar day, never a UTC instant.
  day        date        not null,
  done       boolean     not null,
  updated_at timestamptz not null,
  primary key (user_id, habit_id, day),
  -- Includes user_id, so a completion can only ever point at the same user's habit.
  foreign key (user_id, habit_id) references public.habits (user_id, id) on delete cascade
);

-- ---------------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------------

alter table public.habits      enable row level security;
alter table public.tasks       enable row level security;
alter table public.completions enable row level security;

-- Signed-out visitors get nothing at all, not even an empty read.
revoke all on public.habits, public.tasks, public.completions from anon;

-- `(select auth.uid())` rather than `auth.uid()`: Postgres evaluates it once per
-- query instead of once per row. Same result, much cheaper on large tables.

create policy "Own habits: read"   on public.habits for select to authenticated using ((select auth.uid()) = user_id);
create policy "Own habits: add"    on public.habits for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "Own habits: change" on public.habits for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "Own habits: remove" on public.habits for delete to authenticated using ((select auth.uid()) = user_id);

create policy "Own tasks: read"   on public.tasks for select to authenticated using ((select auth.uid()) = user_id);
create policy "Own tasks: add"    on public.tasks for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "Own tasks: change" on public.tasks for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "Own tasks: remove" on public.tasks for delete to authenticated using ((select auth.uid()) = user_id);

create policy "Own completions: read"   on public.completions for select to authenticated using ((select auth.uid()) = user_id);
create policy "Own completions: add"    on public.completions for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "Own completions: change" on public.completions for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "Own completions: remove" on public.completions for delete to authenticated using ((select auth.uid()) = user_id);
