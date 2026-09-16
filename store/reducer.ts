import { completionKey } from '@/lib/keys';
import { newId } from '@/lib/id';
import type { DateKey, HabibitState } from '@/lib/types';

export const initialState: HabibitState = {
  habits: [],
  tasks: [],
  completions: {},
};

/**
 * What the UI asks for. Every write to Habibit state starts as one of these.
 *
 * This list is the mutation contract, and in v2 it becomes the API surface
 * almost verbatim (`ADD_HABIT` -> `POST /habits`).
 */
export type HabibitIntent =
  | { type: 'ADD_HABIT'; title: string }
  | { type: 'REMOVE_HABIT'; id: string }
  /**
   * Changes only the title. Completions are keyed by the habit's id, never its
   * title, so the whole history follows a rename for free — which is the
   * reason ids exist at all.
   */
  | { type: 'RENAME_HABIT'; id: string; title: string }
  | { type: 'TOGGLE_COMPLETION'; habitId: string; dateKey: DateKey }
  | { type: 'ADD_TASK'; title: string }
  | { type: 'TOGGLE_TASK'; id: string }
  | { type: 'REMOVE_TASK'; id: string }
  | { type: 'RENAME_TASK'; id: string; title: string };

/**
 * An intent with everything non-deterministic already decided: the time it
 * happened, and for adds, the new record's id.
 *
 * Deciding these *outside* the reducer is what keeps the reducer pure. Given the
 * same state and the same action it always produces the same result, so an
 * action can be stored, retried or replayed on another device later — which is
 * exactly what the sync outbox will do.
 */
type Stamped<I> = I extends { type: 'ADD_HABIT' | 'ADD_TASK' }
  ? I & { id: string; at: string }
  : I & { at: string };

export type HabibitAction =
  /**
   * Replace everything, used when loading from storage or when another tab
   * writes. The state is validated at the storage boundary, so by the time it
   * reaches here it is already trusted.
   */
  | { type: 'HYDRATE'; state: HabibitState }
  | Stamped<HabibitIntent>;

/** Turns what the UI asked for into a replayable action. The only impure step. */
export function stamp(
  intent: HabibitIntent,
  now: Date = new Date(),
  makeId: () => string = newId,
): Stamped<HabibitIntent> {
  const at = now.toISOString();
  if (intent.type === 'ADD_HABIT' || intent.type === 'ADD_TASK') {
    return { ...intent, id: makeId(), at };
  }
  return { ...intent, at };
}

/**
 * Pure. Never mutates `state`, never reads the clock, never makes ids.
 *
 * Every write sets `updatedAt` to the action's time. Deleted records are kept
 * as tombstones and treated as unknown by every other action, so nothing can
 * quietly bring a deleted habit back to life.
 */
export function habibitReducer(state: HabibitState, action: HabibitAction): HabibitState {
  switch (action.type) {
    case 'HYDRATE':
      return action.state;

    case 'ADD_HABIT': {
      const title = action.title.trim();
      if (!title) return state;
      return {
        ...state,
        habits: [
          ...state.habits,
          {
            id: action.id,
            title,
            createdAt: action.at,
            updatedAt: action.at,
            archivedAt: null,
            deletedAt: null,
          },
        ],
      };
    }

    case 'REMOVE_HABIT': {
      if (!state.habits.some((h) => h.id === action.id && h.deletedAt === null)) return state;
      /*
       * A tombstone, not a removal, so the delete can reach other devices.
       * Its completions are left as they are: every selector already ignores a
       * deleted habit, and a device that syncs later still needs the rows to
       * agree on. Clearing tombstones out for good is a job for after sync
       * exists, once the server has confirmed it has them.
       */
      return {
        ...state,
        habits: state.habits.map((h) =>
          h.id === action.id ? { ...h, deletedAt: action.at, updatedAt: action.at } : h,
        ),
      };
    }

    case 'RENAME_HABIT': {
      const title = action.title.trim();
      // An empty rename is rejected rather than treated as a delete.
      if (!title) return state;
      const habit = state.habits.find((h) => h.id === action.id && h.deletedAt === null);
      if (!habit || habit.title === title) return state;
      return {
        ...state,
        habits: state.habits.map((h) =>
          h.id === action.id ? { ...h, title, updatedAt: action.at } : h,
        ),
      };
    }

    case 'TOGGLE_COMPLETION': {
      if (!state.habits.some((h) => h.id === action.habitId && h.deletedAt === null)) return state;
      const key = completionKey(action.habitId, action.dateKey);
      const done = !state.completions[key]?.done;
      // Unticking keeps the record with `done: false`, so the untick can sync.
      return {
        ...state,
        completions: { ...state.completions, [key]: { done, updatedAt: action.at } },
      };
    }

    case 'ADD_TASK': {
      const title = action.title.trim();
      if (!title) return state;
      return {
        ...state,
        tasks: [
          ...state.tasks,
          {
            id: action.id,
            title,
            createdAt: action.at,
            updatedAt: action.at,
            completedAt: null,
            deletedAt: null,
          },
        ],
      };
    }

    case 'TOGGLE_TASK': {
      if (!state.tasks.some((t) => t.id === action.id && t.deletedAt === null)) return state;
      return {
        ...state,
        tasks: state.tasks.map((t) =>
          t.id === action.id
            ? { ...t, completedAt: t.completedAt ? null : action.at, updatedAt: action.at }
            : t,
        ),
      };
    }

    case 'RENAME_TASK': {
      const title = action.title.trim();
      if (!title) return state;
      const task = state.tasks.find((t) => t.id === action.id && t.deletedAt === null);
      if (!task || task.title === title) return state;
      return {
        ...state,
        tasks: state.tasks.map((t) =>
          t.id === action.id ? { ...t, title, updatedAt: action.at } : t,
        ),
      };
    }

    case 'REMOVE_TASK': {
      if (!state.tasks.some((t) => t.id === action.id && t.deletedAt === null)) return state;
      return {
        ...state,
        tasks: state.tasks.map((t) =>
          t.id === action.id ? { ...t, deletedAt: action.at, updatedAt: action.at } : t,
        ),
      };
    }

    default:
      return state;
  }
}
