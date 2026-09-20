import { isOrderKey } from './order';
import type { Completion, CompletionKey, Habit, HabibitState, Task } from './types';

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
export const SCHEMA_VERSION = 2;

type Envelope = { version: number; state: HabibitState };

/**
 * Accessing `localStorage` can itself throw — some privacy modes and enterprise
 * policies make the property access fail, not just the read. Exported so the
 * theme preference goes through the same guarded accessor.
 */
export function getStore(): Storage | null {
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

/*
 * Validators are strict about the fields we rely on and deliberately lenient
 * about extra ones: a newer build that adds a field should still be readable by
 * an older one. That is also why a leftover v1 `emoji` field is harmless.
 */

function isHabit(value: unknown): value is Habit {
  return (
    isRecord(value) &&
    isNonEmptyString(value.id) &&
    typeof value.title === 'string' &&
    isNonEmptyString(value.createdAt) &&
    isNonEmptyString(value.updatedAt) &&
    isNullableString(value.archivedAt) &&
    isNullableString(value.deletedAt) &&
    // Optional: data saved before v3 has no position at all (see withPositions).
    (value.position === undefined || isNullableString(value.position))
  );
}

function isTask(value: unknown): value is Task {
  return (
    isRecord(value) &&
    isNonEmptyString(value.id) &&
    typeof value.title === 'string' &&
    isNonEmptyString(value.createdAt) &&
    isNonEmptyString(value.updatedAt) &&
    isNullableString(value.completedAt) &&
    isNullableString(value.deletedAt)
  );
}

function isCompletion(value: unknown): value is Completion {
  return isRecord(value) && typeof value.done === 'boolean' && isNonEmptyString(value.updatedAt);
}

/** A valid state in the current (v2) shape. */
export function isHabibitState(value: unknown): value is HabibitState {
  return (
    isRecord(value) &&
    Array.isArray(value.habits) &&
    value.habits.every(isHabit) &&
    Array.isArray(value.tasks) &&
    value.tasks.every(isTask) &&
    isRecord(value.completions) &&
    Object.values(value.completions).every(isCompletion)
  );
}

// ---------------------------------------------------------------------------
// Version 1: the shape shipped from v0.5 to v1.0.0. Frozen here, never edited,
// because it describes data already sitting on people's phones.
// ---------------------------------------------------------------------------

type HabitV1 = { id: string; title: string; emoji: string | null; createdAt: string; archivedAt: string | null };
type TaskV1 = { id: string; title: string; createdAt: string; completedAt: string | null };
type StateV1 = { habits: HabitV1[]; tasks: TaskV1[]; completions: Record<CompletionKey, string> };

function isStateV1(value: unknown): value is StateV1 {
  return (
    isRecord(value) &&
    Array.isArray(value.habits) &&
    value.habits.every(
      (h) =>
        isRecord(h) &&
        isNonEmptyString(h.id) &&
        typeof h.title === 'string' &&
        isNullableString(h.emoji) &&
        isNonEmptyString(h.createdAt) &&
        isNullableString(h.archivedAt),
    ) &&
    Array.isArray(value.tasks) &&
    value.tasks.every(
      (t) =>
        isRecord(t) &&
        isNonEmptyString(t.id) &&
        typeof t.title === 'string' &&
        isNonEmptyString(t.createdAt) &&
        isNullableString(t.completedAt),
    ) &&
    isRecord(value.completions) &&
    Object.values(value.completions).every((at) => typeof at === 'string')
  );
}

/**
 * v1 → v2. Nothing a user can see is lost; only bookkeeping is added.
 *
 * - `updatedAt` is the latest instant v1 knew about for each row: when a task
 *   was completed, otherwise when the row was created. v1 kept no edit times,
 *   so a rename made before the upgrade dates from creation. The honest best.
 * - Nothing in v1 is deleted: it purged deleted rows, so there are no
 *   tombstones to recover and `deletedAt` starts null everywhere.
 * - A v1 completion existed only while ticked, so each becomes `done: true`,
 *   dated when it was ticked.
 * - `emoji` is dropped. It was never settable from the UI, so it is always null.
 */
export function migrateV1(state: StateV1): HabibitState {
  return {
    habits: state.habits.map((h) => ({
      id: h.id,
      title: h.title,
      createdAt: h.createdAt,
      updatedAt: h.createdAt,
      archivedAt: h.archivedAt,
      deletedAt: null,
      position: null,
    })),
    tasks: state.tasks.map((t) => ({
      id: t.id,
      title: t.title,
      createdAt: t.createdAt,
      updatedAt: t.completedAt ?? t.createdAt,
      completedAt: t.completedAt,
      deletedAt: null,
    })),
    completions: Object.fromEntries(
      Object.entries(state.completions).map(([key, at]) => [key, { done: true, updatedAt: at }]),
    ) as HabibitState['completions'],
  };
}

/**
 * Fills in `position` where it is missing or unusable.
 *
 * v3 added the field *without* a new schema version, on purpose. Version numbers
 * are refused when unknown, so bumping it would make a tab still running the
 * previous build treat this data as corrupt. An older build instead ignores the
 * extra field, and this build reads the older data as "no position yet".
 */
function withPositions(state: HabibitState): HabibitState {
  return {
    ...state,
    habits: state.habits.map((h) => ({ ...h, position: isOrderKey(h.position) ? h.position : null })),
  };
}

/**
 * Brings any stored envelope up to the current shape, one version at a time.
 * Unknown versions — including ones from a *newer* build — are refused rather
 * than guessed at, and end up in quarantine.
 */
function migrate(version: unknown, state: unknown): HabibitState | null {
  if (version === SCHEMA_VERSION) return isHabibitState(state) ? withPositions(state) : null;
  if (version === 1) return isStateV1(state) ? migrateV1(state) : null;
  return null;
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
