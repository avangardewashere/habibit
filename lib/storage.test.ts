import { afterEach, describe, expect, it } from 'vitest';
import realV1 from './fixtures/storage-v1.json';
import {
  CORRUPT_KEY,
  SCHEMA_VERSION,
  STORAGE_KEY,
  isHabibitState,
  loadState,
  migrateV1,
  saveState,
} from './storage';
import type { HabibitState } from './types';

/**
 * A minimal in-memory Storage. Enough to exercise the boundary without pulling
 * jsdom in — every test in this project stays a pure node run.
 */
function createMemoryStorage(options: { failWrites?: boolean } = {}): Storage {
  const map = new Map<string, string>();
  return {
    get length() {
      return map.size;
    },
    key: (i) => [...map.keys()][i] ?? null,
    getItem: (k) => map.get(k) ?? null,
    setItem: (k, v) => {
      if (options.failWrites) {
        const error = new Error('QuotaExceededError');
        error.name = 'QuotaExceededError';
        throw error;
      }
      map.set(k, String(v));
    },
    removeItem: (k) => void map.delete(k),
    clear: () => map.clear(),
  };
}

function installStorage(store: Storage | undefined): void {
  Object.defineProperty(globalThis, 'localStorage', {
    value: store,
    configurable: true,
    writable: true,
  });
}

afterEach(() => installStorage(undefined));

const sample: HabibitState = {
  habits: [
    {
      id: 'h1',
      title: 'Drink water',
      createdAt: '2026-09-08T00:00:00.000Z',
      updatedAt: '2026-09-08T00:00:00.000Z',
      archivedAt: null,
      deletedAt: null,
    },
    {
      id: 'h2',
      title: 'Deleted habit',
      createdAt: '2026-09-08T00:00:00.000Z',
      updatedAt: '2026-09-09T00:00:00.000Z',
      archivedAt: null,
      deletedAt: '2026-09-09T00:00:00.000Z',
    },
  ],
  tasks: [
    {
      id: 't1',
      title: 'Book dentist',
      createdAt: '2026-09-08T00:00:00.000Z',
      updatedAt: '2026-09-08T00:00:00.000Z',
      completedAt: null,
      deletedAt: null,
    },
  ],
  completions: {
    'h1::2026-09-08': { done: true, updatedAt: '2026-09-08T01:00:00.000Z' },
    'h1::2026-09-07': { done: false, updatedAt: '2026-09-08T02:00:00.000Z' },
  },
};

/** Puts a raw envelope in a fresh store and tries to load it. */
function loadRaw(raw: string) {
  const store = createMemoryStorage();
  installStorage(store);
  store.setItem(STORAGE_KEY, raw);
  return { store, state: loadState() };
}

describe('save/load round trip', () => {
  it('returns an equal state, tombstones and unticks included', () => {
    installStorage(createMemoryStorage());

    expect(saveState(sample)).toBe(true);
    expect(loadState()).toEqual(sample);
  });

  it('writes a versioned envelope, not a bare state', () => {
    const store = createMemoryStorage();
    installStorage(store);
    saveState(sample);

    const raw = JSON.parse(store.getItem(STORAGE_KEY)!);
    expect(raw.version).toBe(SCHEMA_VERSION);
    expect(raw.state).toEqual(sample);
  });

  it('returns null when nothing is stored', () => {
    installStorage(createMemoryStorage());
    expect(loadState()).toBeNull();
  });
});

describe('bad data never crashes the app', () => {
  it('discards malformed JSON and quarantines it', () => {
    const { store, state } = loadRaw('{{{ not json');
    expect(state).toBeNull();
    expect(store.getItem(CORRUPT_KEY)).toBe('{{{ not json');
  });

  it('discards a valid-JSON but wrong-shaped state', () => {
    const bad = JSON.stringify({ version: SCHEMA_VERSION, state: { habits: 'nope' } });
    const { store, state } = loadRaw(bad);
    expect(state).toBeNull();
    expect(store.getItem(CORRUPT_KEY)).toBe(bad);
  });

  it('discards a state whose habits are missing required fields', () => {
    const { state } = loadRaw(
      JSON.stringify({ version: SCHEMA_VERSION, state: { habits: [{ title: 'no id' }], tasks: [], completions: {} } }),
    );
    expect(state).toBeNull();
  });

  it('discards a habit with no updatedAt', () => {
    // JSON.stringify drops undefined, so the stored habit has no updatedAt key at all.
    const noUpdatedAt = { ...sample.habits[0], updatedAt: undefined };
    const { state } = loadRaw(JSON.stringify({ version: SCHEMA_VERSION, state: { ...sample, habits: [noUpdatedAt] } }));
    expect(state).toBeNull();
  });

  it('discards a task with no deletedAt field', () => {
    const noDeletedAt = { ...sample.tasks[0], deletedAt: undefined };
    const { state } = loadRaw(JSON.stringify({ version: SCHEMA_VERSION, state: { ...sample, tasks: [noDeletedAt] } }));
    expect(state).toBeNull();
  });

  it('discards a completion still in the old v1 string form inside a v2 envelope', () => {
    const { state } = loadRaw(
      JSON.stringify({
        version: SCHEMA_VERSION,
        state: { ...sample, completions: { 'h1::2026-09-08': '2026-09-08T01:00:00.000Z' } },
      }),
    );
    expect(state).toBeNull();
  });

  it('discards a completion whose done flag is not a boolean', () => {
    const { state } = loadRaw(
      JSON.stringify({
        version: SCHEMA_VERSION,
        state: { ...sample, completions: { 'h1::2026-09-08': { done: 'yes', updatedAt: '2026-09-08T01:00:00.000Z' } } },
      }),
    );
    expect(state).toBeNull();
  });

  it('refuses data from a newer build (version 3) rather than guessing', () => {
    const { store, state } = loadRaw(JSON.stringify({ version: 3, state: sample }));
    expect(state).toBeNull();
    expect(store.getItem(CORRUPT_KEY)).toBeTruthy();
  });
});

describe('write failures are reported, not thrown', () => {
  it('returns false when setItem throws', () => {
    installStorage(createMemoryStorage({ failWrites: true }));
    expect(() => saveState(sample)).not.toThrow();
    expect(saveState(sample)).toBe(false);
  });

  it('returns false when there is no storage at all (server render)', () => {
    installStorage(undefined);
    expect(saveState(sample)).toBe(false);
    expect(loadState()).toBeNull();
  });
});

describe('isHabibitState', () => {
  it('accepts the empty state', () => {
    expect(isHabibitState({ habits: [], tasks: [], completions: {} })).toBe(true);
  });

  it('is lenient about extra fields, so an older build can read a newer one', () => {
    expect(
      isHabibitState({
        habits: [{ ...sample.habits[0], colour: 'coral', emoji: null }],
        tasks: [],
        completions: {},
        somethingNew: true,
      }),
    ).toBe(true);
  });

  it('rejects arrays, null and primitives', () => {
    for (const value of [null, undefined, 42, 'x', []]) {
      expect(isHabibitState(value)).toBe(false);
    }
  });
});

/*
 * The upgrade. The fixture is not hand-written: it was captured from the live
 * v1.0.0 app at habibit.vercel.app by adding habits and tasks, filling in a
 * streak, ticking and unticking a day, renaming a habit, and deleting a habit
 * and a task. It is exactly what is sitting in people's browsers today.
 */
describe('upgrading real v1 data to v2', () => {
  const RAW_V1 = JSON.stringify(realV1);
  const v1 = realV1.state;

  it('the fixture really is version 1, and the app is now version 2', () => {
    expect(realV1.version).toBe(1);
    expect(SCHEMA_VERSION).toBe(2);
  });

  it('⭐ loads, and every habit, task and tick survives', () => {
    const { state } = loadRaw(RAW_V1);
    expect(state).not.toBeNull();

    expect(state!.habits.map((h) => [h.id, h.title])).toEqual(v1.habits.map((h) => [h.id, h.title]));
    expect(state!.tasks.map((t) => [t.id, t.title, t.completedAt])).toEqual(
      v1.tasks.map((t) => [t.id, t.title, t.completedAt]),
    );
    expect(Object.keys(state!.completions).sort()).toEqual(Object.keys(v1.completions).sort());
  });

  it('produces a state that passes the v2 validator', () => {
    expect(isHabibitState(loadRaw(RAW_V1).state)).toBe(true);
  });

  it('turns every v1 tick into done: true, dated when it was ticked', () => {
    const { state } = loadRaw(RAW_V1);
    for (const [key, at] of Object.entries(v1.completions)) {
      expect(state!.completions[key as `${string}::${string}`]).toEqual({ done: true, updatedAt: at });
    }
  });

  it('dates each row from the latest time v1 knew about', () => {
    const { state } = loadRaw(RAW_V1);
    for (const habit of state!.habits) {
      expect(habit.updatedAt).toBe(habit.createdAt);
    }
    const done = state!.tasks.find((t) => t.title === 'Call mum')!;
    const open = state!.tasks.find((t) => t.title === 'Book dentist')!;
    expect(done.updatedAt).toBe(done.completedAt);
    expect(open.updatedAt).toBe(open.createdAt);
  });

  it('starts with no tombstones, and drops the unused emoji field', () => {
    const { state } = loadRaw(RAW_V1);
    expect(state!.habits.every((h) => h.deletedAt === null && !('emoji' in h))).toBe(true);
    expect(state!.tasks.every((t) => t.deletedAt === null)).toBe(true);
  });

  it('⭐ writes nothing just by loading: the original v1 bytes stay until the first edit', () => {
    // If a bug in the upgrade ever loses data, the original is still on disk.
    const { store } = loadRaw(RAW_V1);
    expect(store.getItem(STORAGE_KEY)).toBe(RAW_V1);
    expect(store.getItem(CORRUPT_KEY)).toBeNull();
  });

  it('saves as version 2 once written, and loads back identically', () => {
    const { store, state } = loadRaw(RAW_V1);
    saveState(state!);

    expect(JSON.parse(store.getItem(STORAGE_KEY)!).version).toBe(2);
    expect(loadState()).toEqual(state);
  });

  it('keeps archivedAt from v1', () => {
    const archived = { ...v1, habits: [{ ...v1.habits[0], archivedAt: '2026-09-10T00:00:00.000Z' }] };
    expect(migrateV1(archived).habits[0].archivedAt).toBe('2026-09-10T00:00:00.000Z');
  });

  it('does not mutate the v1 state it is given', () => {
    const copy = structuredClone(v1);
    migrateV1(v1);
    expect(v1).toEqual(copy);
  });

  it('quarantines corrupt v1 data instead of upgrading it', () => {
    const bad = JSON.stringify({ version: 1, state: { habits: [{ title: 'no id' }], tasks: [], completions: {} } });
    const { store, state } = loadRaw(bad);
    expect(state).toBeNull();
    expect(store.getItem(CORRUPT_KEY)).toBe(bad);
  });

  it('quarantines a v1 completions map holding a non-string value', () => {
    const { state } = loadRaw(
      JSON.stringify({ version: 1, state: { habits: [], tasks: [], completions: { 'h1::2026-09-08': 42 } } }),
    );
    expect(state).toBeNull();
  });

  it('refuses v2-shaped data that claims to be version 1', () => {
    expect(loadRaw(JSON.stringify({ version: 1, state: sample })).state).toBeNull();
  });
});
