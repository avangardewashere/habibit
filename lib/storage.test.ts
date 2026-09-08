import { afterEach, describe, expect, it } from 'vitest';
import {
  CORRUPT_KEY,
  SCHEMA_VERSION,
  STORAGE_KEY,
  isHabibitState,
  loadState,
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

function useStorage(store: Storage | undefined): void {
  Object.defineProperty(globalThis, 'localStorage', {
    value: store,
    configurable: true,
    writable: true,
  });
}

afterEach(() => useStorage(undefined));

const sample: HabibitState = {
  habits: [
    {
      id: 'h1',
      title: 'Drink water',
      emoji: null,
      createdAt: '2026-09-08T00:00:00.000Z',
      archivedAt: null,
    },
  ],
  tasks: [
    { id: 't1', title: 'Book dentist', createdAt: '2026-09-08T00:00:00.000Z', completedAt: null },
  ],
  completions: { 'h1::2026-09-08': '2026-09-08T01:00:00.000Z' },
};

describe('save/load round trip', () => {
  it('returns an equal state', () => {
    const store = createMemoryStorage();
    useStorage(store);

    expect(saveState(sample)).toBe(true);
    expect(loadState()).toEqual(sample);
  });

  it('writes a versioned envelope, not a bare state', () => {
    const store = createMemoryStorage();
    useStorage(store);
    saveState(sample);

    const raw = JSON.parse(store.getItem(STORAGE_KEY)!);
    expect(raw.version).toBe(SCHEMA_VERSION);
    expect(raw.state).toEqual(sample);
  });

  it('returns null when nothing is stored', () => {
    useStorage(createMemoryStorage());
    expect(loadState()).toBeNull();
  });
});

describe('bad data never crashes the app', () => {
  it('discards malformed JSON and quarantines it', () => {
    const store = createMemoryStorage();
    useStorage(store);
    store.setItem(STORAGE_KEY, '{{{ not json');

    expect(loadState()).toBeNull();
    expect(store.getItem(CORRUPT_KEY)).toBe('{{{ not json');
  });

  it('discards a valid-JSON but wrong-shaped state', () => {
    const store = createMemoryStorage();
    useStorage(store);
    const bad = JSON.stringify({ version: SCHEMA_VERSION, state: { habits: 'nope' } });
    store.setItem(STORAGE_KEY, bad);

    expect(loadState()).toBeNull();
    expect(store.getItem(CORRUPT_KEY)).toBe(bad);
  });

  it('discards a state whose habits are missing required fields', () => {
    const store = createMemoryStorage();
    useStorage(store);
    store.setItem(
      STORAGE_KEY,
      JSON.stringify({
        version: SCHEMA_VERSION,
        state: { habits: [{ title: 'no id' }], tasks: [], completions: {} },
      }),
    );

    expect(loadState()).toBeNull();
  });

  it('discards an unknown schema version rather than guessing', () => {
    const store = createMemoryStorage();
    useStorage(store);
    store.setItem(STORAGE_KEY, JSON.stringify({ version: 99, state: sample }));

    expect(loadState()).toBeNull();
    expect(store.getItem(CORRUPT_KEY)).toBeTruthy();
  });

  it('survives a completions map holding a non-string value', () => {
    const store = createMemoryStorage();
    useStorage(store);
    store.setItem(
      STORAGE_KEY,
      JSON.stringify({
        version: SCHEMA_VERSION,
        state: { habits: [], tasks: [], completions: { 'h1::2026-09-08': 42 } },
      }),
    );

    expect(loadState()).toBeNull();
  });
});

describe('write failures are reported, not thrown', () => {
  it('returns false when setItem throws', () => {
    useStorage(createMemoryStorage({ failWrites: true }));
    expect(() => saveState(sample)).not.toThrow();
    expect(saveState(sample)).toBe(false);
  });

  it('returns false when there is no storage at all (server render)', () => {
    useStorage(undefined);
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
        habits: [{ ...sample.habits[0], colour: 'coral' }],
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
