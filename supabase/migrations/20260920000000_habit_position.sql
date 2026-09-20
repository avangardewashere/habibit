-- Habibit v3 Block B: where each habit sits in your list.
--
-- A sort key made by the app (lib/order.ts): a new key can always be made
-- between two others, so moving a habit rewrites only that habit's row, and two
-- devices reordering at once can't scramble each other.
--
-- Compared as plain text, character by character. The app does the sorting;
-- any SQL that ever sorts by this must use COLLATE "C", or a locale-aware
-- collation would order "a" and "B" differently from every device.
--
-- Nullable on purpose. Rows from before v3 have none, and a device still
-- running an older build uploads habits without it; the app lists those after
-- the positioned ones, oldest first. An upload that leaves the column out does
-- not touch a position already stored.

alter table public.habits
  add column position text
  -- Base-62 digits, never ending in 0, and not absurdly long. The app never
  -- writes anything else; this makes a bad write fail loudly rather than
  -- quietly spoil the order on every other device.
  constraint habits_position_is_order_key
    check (position ~ '^[0-9A-Za-z]*[1-9A-Za-z]$' and char_length(position) <= 256);
