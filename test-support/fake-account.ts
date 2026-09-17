import { mergeStates, type Changes } from '@/lib/sync/merge';
import type { RemoteStore } from '@/lib/sync/remote';
import type { CompletionKey, HabibitState } from '@/lib/types';

type Stored<T> = { record: T; serverTime: number };

/**
 * An in-memory account that behaves like the real database where it matters:
 *
 * - an upload never replaces a row with an older version (the keep-latest trigger)
 * - every stored write gets the *server's* time (the server-time trigger)
 * - `pullSince` returns only rows written after the given server time
 *
 * Many "devices" can share one account. Its clock only moves when something is
 * written, so tests are exact and never depend on real time.
 */
export function fakeAccount() {
  let clock = Date.UTC(2026, 8, 18, 0, 0, 0);
  const habits = new Map<string, Stored<HabibitState['habits'][number]>>();
  const tasks = new Map<string, Stored<HabibitState['tasks'][number]>>();
  const completions = new Map<CompletionKey, Stored<HabibitState['completions'][CompletionKey]>>();
  let rowsServed = 0;
  let offline = false;

  function write<K, T extends { updatedAt: string }>(table: Map<K, Stored<T>>, key: K, record: T, serverTime?: number) {
    const existing = table.get(key);
    if (existing && Date.parse(record.updatedAt) < Date.parse(existing.record.updatedAt)) return; // stale: kept as is
    clock += 1_000;
    table.set(key, { record: structuredClone(record), serverTime: serverTime ?? clock });
  }

  const iso = (ms: number) => new Date(ms).toISOString();

  const account = {
    remote(): RemoteStore {
      return {
        async pullSince(since) {
          if (offline) throw new Error('offline');
          const after = since === null ? -Infinity : Date.parse(since);
          let max = -Infinity;
          const pick = <K, T>(table: Map<K, Stored<T>>) =>
            [...table.entries()].filter(([, s]) => s.serverTime > after).map(([key, s]) => {
              max = Math.max(max, s.serverTime);
              rowsServed += 1;
              return [key, structuredClone(s.record)] as const;
            });
          const state: HabibitState = {
            habits: pick(habits).map(([, r]) => r),
            tasks: pick(tasks).map(([, r]) => r),
            completions: Object.fromEntries(pick(completions)) as HabibitState['completions'],
          };
          return { state: mergeStates({ habits: [], tasks: [], completions: {} }, state), cursor: max === -Infinity ? null : iso(max) };
        },
        async push(changes: Changes) {
          if (offline) throw new Error('offline');
          for (const h of changes.habits) write(habits, h.id, h);
          for (const t of changes.tasks) write(tasks, t.id, t);
          for (const [key, c] of changes.completions) write(completions, key, c);
        },
      };
    },

    /** What the account holds now, as app data. */
    snapshot(): HabibitState {
      return mergeStates(
        { habits: [], tasks: [], completions: {} },
        {
          habits: [...habits.values()].map((s) => s.record),
          tasks: [...tasks.values()].map((s) => s.record),
          completions: Object.fromEntries([...completions.entries()].map(([k, s]) => [k, s.record])),
        },
      );
    },

    /** How many rows all pulls have returned so far. */
    rowsServed: () => rowsServed,
    resetRowsServed: () => {
      rowsServed = 0;
    },

    setOffline(value: boolean) {
      offline = value;
    },

    /**
     * Stores a habit as if its write committed late: stamped with a server time
     * `msEarlier` before the account's current clock.
     */
    writeLateHabit(record: HabibitState['habits'][number], msEarlier: number) {
      write(habits, record.id, record, clock - msEarlier);
    },

    now: () => iso(clock),

    /** Moves the account's clock on, as if time passed with nobody writing. */
    advance(ms: number) {
      clock += ms;
    },
  };
  return account;
}
