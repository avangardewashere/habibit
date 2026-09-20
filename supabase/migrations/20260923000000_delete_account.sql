-- Habibit v3 Block F: leaving.
--
-- Everything Habibit stores about you hangs off one row in `auth.users` by
-- `on delete cascade` — habits, tasks, completions, reminder settings, the
-- devices registered for push. So leaving is one delete, and the work is making
-- sure it is *only ever your own*.

/*
 * Deletes the account of whoever is calling, and everything that cascades from
 * it. Returns true if there was an account to delete.
 *
 * ## Why it takes no arguments
 *
 * The obvious shape — `delete_account(id uuid)` — is the wrong shape. It puts
 * the choice of whose account to delete in the caller's hands, and then needs a
 * check that the id is theirs. A check that has to be written can be forgotten,
 * reordered, or skipped by a later edit.
 *
 * Taking no arguments means there is nothing to tamper with: the only id it can
 * ever see is the one in the caller's own signed token, which the database
 * reads for itself. A signed-out caller has no id at all, and gets `false`.
 *
 * ## Why `security definer`, and what that costs
 *
 * `auth.users` belongs to the auth system, and a signed-in person has no
 * permission to delete from it — nor should they, in general. This function
 * runs with the privileges of its owner instead, which is what lets that one
 * delete happen.
 *
 * That makes it the most dangerous kind of function in the database, so:
 *
 *   - `set search_path = ''` — without it, a caller could put their own
 *     `auth.uid()` earlier in the search path and have this function call that
 *     instead. Every name below is fully qualified for the same reason.
 *   - the `where` clause is the caller's own id and nothing else. There is no
 *     branch, no parameter, and no way to widen it.
 *   - `anon` cannot call it at all (the grants below).
 */
create function public.delete_my_account()
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller uuid := auth.uid();
begin
  -- Signed out: nothing to delete, and nothing to say about it.
  if caller is null then
    return false;
  end if;

  delete from auth.users where id = caller;
  return found;
end;
$$;

-- Signed-out visitors cannot even call it. It would return false anyway; this
-- is the second lock, in case the first is ever wrong.
revoke all on function public.delete_my_account() from public, anon;
grant execute on function public.delete_my_account() to authenticated;
