import type { SupabaseClient } from '@supabase/supabase-js';
import type { HabibitState } from '@/lib/types';
import type { Changes } from './merge';
import {
  completionToRow,
  habitToRow,
  rowsToState,
  taskToRow,
  type CompletionRow,
  type HabitRow,
  type TaskRow,
} from './rows';

/**
 * Where an account's data lives. The sync logic only ever talks to this, so it
 * can be tested against an in-memory fake with no network and no database.
 */
export interface RemoteStore {
  /** Everything the signed-in account has, tombstones included. */
  pull(): Promise<HabibitState>;
  /** Uploads these records. Resolves only once the server has stored all of them. */
  push(changes: Changes): Promise<void>;
}

/*
 * PostgREST returns at most 1000 rows per request on hosted Supabase. A year of
 * five daily habits is already 1,825 completions, so every read is paged, ordered
 * by the primary key so pages never overlap or skip.
 */
const PAGE = 1000;
// Writes are batched too, to keep each request comfortably small.
const BATCH = 500;

async function readAll<Row>(
  supabase: SupabaseClient,
  table: string,
  columns: string,
  orderBy: string[],
): Promise<Row[]> {
  const rows: Row[] = [];
  for (let from = 0; ; from += PAGE) {
    let query = supabase.from(table).select(columns);
    for (const column of orderBy) query = query.order(column);
    const { data, error } = await query.range(from, from + PAGE - 1);
    if (error) throw error;
    rows.push(...(data as Row[]));
    if (data.length < PAGE) return rows;
  }
}

async function writeAll(supabase: SupabaseClient, table: string, rows: object[], onConflict: string) {
  for (let i = 0; i < rows.length; i += BATCH) {
    const { error } = await supabase.from(table).upsert(rows.slice(i, i + BATCH), { onConflict });
    if (error) throw error;
  }
}

export function supabaseRemote(supabase: SupabaseClient): RemoteStore {
  return {
    async pull() {
      // Row Level Security already limits every query to the signed-in user.
      const [habits, tasks, completions] = await Promise.all([
        readAll<HabitRow>(supabase, 'habits', 'id,title,created_at,updated_at,archived_at,deleted_at', ['id']),
        readAll<TaskRow>(supabase, 'tasks', 'id,title,created_at,updated_at,completed_at,deleted_at', ['id']),
        readAll<CompletionRow>(supabase, 'completions', 'habit_id,day,done,updated_at', ['habit_id', 'day']),
      ]);
      return rowsToState(habits, tasks, completions);
    },

    async push(changes) {
      // Habits before completions: a completion must point at a habit the database already has.
      // `user_id` is never sent; the database fills it in from the sign-in.
      await writeAll(supabase, 'habits', changes.habits.map(habitToRow), 'user_id,id');
      await writeAll(supabase, 'tasks', changes.tasks.map(taskToRow), 'user_id,id');
      await writeAll(
        supabase,
        'completions',
        changes.completions.map(([key, c]) => completionToRow(key, c)),
        'user_id,habit_id,day',
      );
    },
  };
}
