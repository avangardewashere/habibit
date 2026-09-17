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

export type Pulled = {
  /** The rows that were read, as app data. */
  state: HabibitState;
  /**
   * The latest server time among those rows, or `null` if there were none.
   * Passing it back to `pullSince` asks for "anything changed after this".
   */
  cursor: string | null;
};

/**
 * Where an account's data lives. The sync logic only ever talks to this, so it
 * can be tested against an in-memory fake with no network and no database.
 */
export interface RemoteStore {
  /**
   * Rows changed after `since` (a server time from an earlier pull), or every
   * row when `since` is `null`. Tombstones included.
   */
  pullSince(since: string | null): Promise<Pulled>;
  /** Uploads these records. Resolves only once the server has stored all of them. */
  push(changes: Changes): Promise<void>;
}

/*
 * PostgREST returns at most 1000 rows per request on hosted Supabase. A year of
 * five daily habits is already 1,825 completions, so every read is paged, with a
 * stable order so pages never overlap or skip.
 */
const PAGE = 1000;
// Writes are batched too, to keep each request comfortably small.
const BATCH = 500;

type WithServerTime = { server_updated_at: string };

async function readAll<Row extends WithServerTime>(
  supabase: SupabaseClient,
  table: string,
  columns: string,
  key: string[],
  since: string | null,
): Promise<Row[]> {
  const rows: Row[] = [];
  for (let from = 0; ; from += PAGE) {
    let query = supabase.from(table).select(`${columns},server_updated_at`);
    if (since) query = query.gt('server_updated_at', since);
    for (const column of ['server_updated_at', ...key]) query = query.order(column);
    const { data, error } = await query.range(from, from + PAGE - 1);
    if (error) throw error;
    rows.push(...(data as unknown as Row[]));
    if (data.length < PAGE) return rows;
  }
}

async function writeAll(supabase: SupabaseClient, table: string, rows: object[], onConflict: string) {
  for (let i = 0; i < rows.length; i += BATCH) {
    const { error } = await supabase.from(table).upsert(rows.slice(i, i + BATCH), { onConflict });
    if (error) throw error;
  }
}

/**
 * The latest server time among these rows, **exactly as the database wrote it**.
 *
 * Postgres keeps microseconds ("…:03.123456+00:00"); a JavaScript Date keeps only
 * milliseconds. Converting would round the cursor down to "…:03.123", and asking
 * for rows "after" that would return the very row it came from, every time. The
 * database's own text is passed back untouched instead. Within the same
 * millisecond, its fixed format compares correctly as text.
 */
function latest(...groups: WithServerTime[][]): string | null {
  let max: string | null = null;
  let maxMs = -Infinity;
  for (const rows of groups) {
    for (const row of rows) {
      const ms = Date.parse(row.server_updated_at);
      if (ms > maxMs || (ms === maxMs && max !== null && row.server_updated_at > max)) {
        maxMs = ms;
        max = row.server_updated_at;
      }
    }
  }
  return max;
}

export function supabaseRemote(supabase: SupabaseClient): RemoteStore {
  return {
    async pullSince(since) {
      // Row Level Security already limits every query to the signed-in user.
      const [habits, tasks, completions] = await Promise.all([
        readAll<HabitRow & WithServerTime>(supabase, 'habits', 'id,title,created_at,updated_at,archived_at,deleted_at', ['id'], since),
        readAll<TaskRow & WithServerTime>(supabase, 'tasks', 'id,title,created_at,updated_at,completed_at,deleted_at', ['id'], since),
        readAll<CompletionRow & WithServerTime>(supabase, 'completions', 'habit_id,day,done,updated_at', ['habit_id', 'day'], since),
      ]);
      return { state: rowsToState(habits, tasks, completions), cursor: latest(habits, tasks, completions) };
    },

    async push(changes) {
      // Habits before completions: a completion must point at a habit the database already has.
      // `user_id` and `server_updated_at` are never sent; the database fills both in.
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
