-- Habibit v4 Block B: how often a habit is meant to be kept.
--
-- Text, in the form the app reads in lib/schedule.ts: 'weekdays:0,2,4' (Monday
-- is 0) or 'weekly:3' (three times a week, any days). NULL means every day,
-- which is what every habit made before v4 is — so this column starts NULL
-- everywhere and nobody's list changes.
--
-- Nullable, and never required: a device still running an older build uploads
-- habits without this column, and an upsert that leaves a column out does not
-- touch what is stored. That is the risk v4's plan singles out, and it has its
-- own test (supabase/tests/schedule.test.ts).
--
-- The check deliberately does NOT list the kinds the app knows today. A later
-- version will add kinds ("every third day"), and a database that refuses them
-- would have to be migrated in lock-step with every phone. It checks the shape
-- only — a lowercase kind, an optional argument, a sane length — so nonsense
-- can't be stored while the meaning stays the app's business. Anything the app
-- cannot read is simply treated as every day, and passed through untouched.

alter table public.habits
  add column schedule text
  constraint habits_schedule_is_shaped_like_one
    check (schedule ~ '^[a-z]+(:[0-9a-z,]+)?$' and char_length(schedule) <= 64);
