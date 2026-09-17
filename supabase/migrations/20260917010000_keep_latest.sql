-- Habibit v2 Block D: the database enforces "latest change wins" itself.
--
-- A device reads the account, merges, then uploads. If another device saves a
-- newer edit in between, that upload arrives carrying an *older* version of the
-- same row. Without this, it would silently overwrite the newer edit.
--
-- This trigger runs before every update, including the update half of an
-- upsert, and skips any update whose updated_at is older than the row already
-- stored. The skipped row is simply left as it was; nothing errors, so a
-- batch upload containing one stale row still stores all the others.

create function public.keep_latest_change()
returns trigger
language plpgsql
-- Pinned so the function can't be redirected by objects in another schema.
set search_path = ''
as $$
begin
  if new.updated_at < old.updated_at then
    return null; -- keep the newer row that is already stored
  end if;
  return new;
end;
$$;

create trigger habits_keep_latest_change
  before update on public.habits
  for each row execute function public.keep_latest_change();

create trigger tasks_keep_latest_change
  before update on public.tasks
  for each row execute function public.keep_latest_change();

create trigger completions_keep_latest_change
  before update on public.completions
  for each row execute function public.keep_latest_change();
