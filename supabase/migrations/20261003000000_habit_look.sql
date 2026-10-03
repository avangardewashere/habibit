-- Habibit v5 Block A: what a habit looks like.
--
-- Two names, in the form the app reads in lib/look.ts: an icon ('droplet',
-- 'book-open') and a colour ('teal'). Both NULL means nothing has been chosen,
-- which is not the same as nothing being shown — the app draws an un-chosen
-- colour from the habit's id and guesses an un-chosen icon from its title. So
-- these columns start NULL everywhere, every habit still gets a face, and not
-- one existing row has to be written.
--
-- Nullable and never required, for the same reason as `schedule` before it: a
-- device still running an older build uploads habits without these columns, and
-- an upsert that leaves a column out does not touch what is stored. v4 Block B
-- proved that rather than assuming it, and supabase/tests/look.test.ts proves it
-- again here.
--
-- The checks deliberately do NOT list the names the app knows today. A later
-- version will add icons, and a database that refuses them would have to be
-- migrated in lock-step with every phone — a phone that cannot upload is a
-- phone that silently stops syncing. They check the shape only: a lowercase
-- name, digits and hyphens allowed after the first character, a sane length.
-- Anything the app cannot draw falls back to the derived look and is passed
-- through untouched.

alter table public.habits
  add column icon text
  constraint habits_icon_is_shaped_like_a_name
    check (icon ~ '^[a-z][a-z0-9-]*$' and char_length(icon) <= 24),
  add column colour text
  constraint habits_colour_is_shaped_like_a_name
    check (colour ~ '^[a-z][a-z0-9-]*$' and char_length(colour) <= 24);
