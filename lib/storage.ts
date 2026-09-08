import type { Habit, HabibitState, Task } from './types';

/**
 * The storage boundary.
 *
 * Everything that can go wrong between "JSON in a browser" and "a valid
 * HabibitState" is handled here, so no component ever has to think about it.
 * Callers get either a state they can trust or `null`.
 */

export const STORAGE_KEY = 'habibit:state';

/**
 * Anything unreadable is copied here before being discarded, so a bad parse
 * never silently destroys someone's history. Nothing reads it automatically —
 * it exists so the data is recoverable by hand.
 */
export const CORRUPT_KEY = 'habibit:state:corrupt';

/**
 * Bump when the persisted shape changes, and teach `migrate()` how to move the
 * old shape forward. The version lives in the envelope rather than the state so
 * that reading it never depends on the state being valid.
 */
export const SCHEMA_VERSION = 1;

type Envelope = { version: number; state: HabibitState };

/**
 * Accessing `localStorage` can itself throw — some privacy modes and enterprise
 * policies make the property access fail, not just the read.
 */
function getStore(): Storage | null {
  try {
    return typeof globalThis.localStorage === 'undefined' ? null : globalThis.localStorage;
  } catch {
    return null;
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.length > 0;
}

function isNullableString(value: unknown): value is string | null {
  return value === null || typeof value === 'string';
}

function isHabit(value: unknown): value is Habit {
  return (
    isRecord(value) &&
    isNonEmptyString(value.id) &&
    typeof value.title === 'string' &&
    isNullableString(value.emoji) &&
    isNonEmptyString(value.createdAt) &&
    isNullableString(value.archivedAt)
  );
}

function isTask(value: unknown): value is Task {
  return (
    isRecord(value) &&
    isNonEmptyString(value.id) &&
    typeof value.title === 'string' &&
    isNonEmptyString(value.createdAt) &&
    isNullableString(value.completedAt)
  );
}

/**
 * Strict about the fields we rely on, deliberately lenient about extra ones:
 * a newer build that adds a field should still be readable by an older one.
 */
export function isHabibitState(value: unknown): value is HabibitState {
  return (
    isRecord(value) &&
    Array.isArray(value.habits) &&
    value.habits.every(isHabit) &&
    Array.isArray(value.tasks) &&
    value.tasks.every(isTask) &&
    isRecord(value.completions) &&
    Object.values(value.completions).every((at) => typeof at === 'string')
  );
}

/**
 * The seam for future schema changes. Today there is only one version, so
 * anything else is discarded — but when v2 arrives, older envelopes get
 * transformed here rather than thrown away.
 */
function migrate(version: unknown, state: unknown): HabibitState | null {
  if (version !== SCHEMA_VERSION) return null;
  return isHabibitState(state) ? state : null;
}

function quarantine(store: Storage, raw: string): void {
  try {
    store.setItem(CORRUPT_KEY, raw);
  } catch {
    // Out of room or storage is blocked. Nothing further we can do, and it must
    // not stop the app from starting.
  }
}

/** The stored state, or `null` if there is nothing usable. Never throws. */
export function loadState(): HabibitState | null {
  const store = getStore();
  if (!store) return null;

  let raw: string | null;
  try {
    raw = store.getItem(STORAGE_KEY);
  } catch {
    return null;
  }
  if (raw === null) return null;

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    quarantine(store, raw);
    return null;
  }

  if (!isRecord(parsed)) {
    quarantine(store, raw);
    return null;
  }

  const state = migrate(parsed.version, parsed.state);
  if (!state) {
    quarantine(store, raw);
    return null;
  }

  return state;
}

/**
 * Returns `false` if the write failed — quota exceeded, or storage blocked.
 * The caller surfaces that, because a habit tracker that only *looks* like it
 * saved is the worst possible failure.
 */
export function saveState(state: HabibitState): boolean {
  const store = getStore();
  if (!store) return false;

  const envelope: Envelope = { version: SCHEMA_VERSION, state };
  try {
    store.setItem(STORAGE_KEY, JSON.stringify(envelope));
    return true;
  } catch {
    return false;
  }
}
