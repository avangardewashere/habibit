import { completionKey } from '@/lib/keys';
import { newId } from '@/lib/id';
import type { DateKey, HabibitState } from '@/lib/types';

export const initialState: HabibitState = {
  habits: [],
  tasks: [],
  completions: {},
};

/**
 * Every write to Habibit state goes through one of these.
 *
 * This list is the mutation contract. In v2 it becomes the API surface almost
 * verbatim (`ADD_HABIT` -> `POST /habits`), which is why it is worth designing
 * now while it costs nothing.
 */
export type HabibitAction =
  | { type: 'ADD_HABIT'; title: string; emoji?: string | null }
  | { type: 'REMOVE_HABIT'; id: string }
  | { type: 'TOGGLE_COMPLETION'; habitId: string; dateKey: DateKey }
  | { type: 'ADD_TASK'; title: string }
  | { type: 'TOGGLE_TASK'; id: string }
  | { type: 'REMOVE_TASK'; id: string };

/** Pure. Never mutates `state`. Testable with no React and no DOM. */
export function habibitReducer(state: HabibitState, action: HabibitAction): HabibitState {
  switch (action.type) {
    case 'ADD_HABIT': {
      const title = action.title.trim();
      if (!title) return state;
      return {
        ...state,
        habits: [
          ...state.habits,
          {
            id: newId(),
            title,
            emoji: action.emoji ?? null,
            createdAt: new Date().toISOString(),
            archivedAt: null,
          },
        ],
      };
    }

    case 'REMOVE_HABIT': {
      if (!state.habits.some((h) => h.id === action.id)) return state;
      // Purge this habit's completions too, so no orphaned keys accumulate.
      // (`Object.entries` widens the key back to `string`, hence the one cast.)
      const prefix = `${action.id}::`;
      const completions = Object.fromEntries(
        Object.entries(state.completions).filter(([key]) => !key.startsWith(prefix)),
      ) as HabibitState['completions'];
      return {
        ...state,
        habits: state.habits.filter((h) => h.id !== action.id),
        completions,
      };
    }

    case 'TOGGLE_COMPLETION': {
      if (!state.habits.some((h) => h.id === action.habitId)) return state;
      const key = completionKey(action.habitId, action.dateKey);
      if (state.completions[key]) {
        const completions = { ...state.completions };
        delete completions[key];
        return { ...state, completions };
      }
      return {
        ...state,
        completions: { ...state.completions, [key]: new Date().toISOString() },
      };
    }

    case 'ADD_TASK': {
      const title = action.title.trim();
      if (!title) return state;
      return {
        ...state,
        tasks: [
          ...state.tasks,
          { id: newId(), title, createdAt: new Date().toISOString(), completedAt: null },
        ],
      };
    }

    case 'TOGGLE_TASK': {
      if (!state.tasks.some((t) => t.id === action.id)) return state;
      return {
        ...state,
        tasks: state.tasks.map((t) =>
          t.id === action.id
            ? { ...t, completedAt: t.completedAt ? null : new Date().toISOString() }
            : t,
        ),
      };
    }

    case 'REMOVE_TASK': {
      if (!state.tasks.some((t) => t.id === action.id)) return state;
      return { ...state, tasks: state.tasks.filter((t) => t.id !== action.id) };
    }

    default:
      return state;
  }
}
