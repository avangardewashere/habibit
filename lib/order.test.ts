import { describe, expect, it } from 'vitest';
import { evenKeys, isOrderKey, keyBetween, LONGEST_KEY } from './order';

/** A small seeded generator, so a failing run can be repeated exactly. */
function random(seed: number) {
  let state = seed >>> 0;
  return () => {
    state = (state * 1664525 + 1013904223) >>> 0;
    return state / 2 ** 32;
  };
}

function expectAscending(keys: string[]) {
  for (let i = 1; i < keys.length; i += 1) {
    if (!(keys[i - 1] < keys[i])) throw new Error(`Out of order at ${i}: ${keys[i - 1]} !< ${keys[i]}`);
  }
}

describe('keyBetween', () => {
  it('V3B-01 · makes a valid first key, and keys before and after it', () => {
    const first = keyBetween(null, null);
    expect(isOrderKey(first)).toBe(true);
    expect(keyBetween(null, first) < first).toBe(true);
    expect(keyBetween(first, null) > first).toBe(true);
  });

  it('V3B-02 · ⭐ thousands of random inserts never break the order', () => {
    const next = random(20260920);
    const keys: string[] = [];
    for (let step = 0; step < 5000; step += 1) {
      const at = Math.floor(next() * (keys.length + 1));
      const key = keyBetween(keys[at - 1] ?? null, keys[at] ?? null);
      expect(isOrderKey(key)).toBe(true);
      keys.splice(at, 0, key);
    }
    expectAscending(keys);
    expect(new Set(keys).size).toBe(keys.length);
  });

  it('V3B-03 · inserting between two neighbouring keys still finds room', () => {
    // "a" and "b" are adjacent digits; the answer has to go one place longer.
    const key = keyBetween('a', 'b');
    expect('a' < key && key < 'b').toBe(true);
    // And again, squeezed towards one side, many times over.
    let low = 'a';
    for (let i = 0; i < 200; i += 1) {
      const mid = keyBetween(low, 'b');
      expect(low < mid && mid < 'b').toBe(true);
      low = mid;
    }
  });

  it('V3B-08 · works between any two valid keys, not just ones it made itself', () => {
    // Keys can arrive from another device or an older build, so the inputs here are
    // random strings rather than earlier outputs. Includes the case random inserts
    // never reach: neighbouring first digits with a longer upper key ("a" and "bV").
    expect(keyBetween('a', 'bV')).toBe('b');
    const next = random(7);
    const DIGITS = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz';
    const randomKey = () => {
      let key = '';
      const length = 1 + Math.floor(next() * 4);
      for (let i = 0; i < length; i += 1) key += DIGITS[Math.floor(next() * DIGITS.length)];
      return key.replace(/0+$/, '') || '1';
    };
    for (let i = 0; i < 10000; i += 1) {
      const [low, high] = [randomKey(), randomKey()].sort();
      if (low === high) continue;
      const key = keyBetween(low, high);
      if (!(low < key && key < high && isOrderKey(key))) {
        throw new Error(`keyBetween(${low}, ${high}) gave ${key}`);
      }
    }
  });

  it('V3B-04 · keys sort by character code, the same on every device', () => {
    // A locale-aware sort puts "a" before "B"; character codes put "B" first.
    // Every device must agree, so only the plain comparison is used.
    expect('B' < 'a').toBe(true);
    const keys = ['a', 'B', '9', 'Z', 'z', '1'];
    expect([...keys].sort()).toEqual(['1', '9', 'B', 'Z', 'a', 'z']);
  });

  it('V3B-05 · refuses keys in the wrong order or malformed', () => {
    expect(() => keyBetween('b', 'a')).toThrow();
    expect(() => keyBetween('a', 'a')).toThrow();
    expect(() => keyBetween('a0', null)).toThrow(); // ends in 0
    expect(() => keyBetween('a-b', null)).toThrow();
    expect(isOrderKey('')).toBe(false);
    expect(isOrderKey(null)).toBe(false);
    expect(isOrderKey('V')).toBe(true);
  });
});

describe('evenKeys', () => {
  it('V3B-06 · gives any list fresh keys: ascending, valid, and short', () => {
    for (const count of [0, 1, 2, 3, 10, 60, 61, 62, 63, 500, 3842, 3843, 5000]) {
      const keys = evenKeys(count);
      expect(keys).toHaveLength(count);
      expectAscending(keys);
      expect(keys.every(isOrderKey)).toBe(true);
      expect(Math.max(0, ...keys.map((k) => k.length))).toBeLessThanOrEqual(count < 3843 ? 2 : 3);
    }
  });

  it('V3B-07 · leaves room between every pair for later moves', () => {
    const keys = evenKeys(20);
    for (let i = 1; i < keys.length; i += 1) {
      const mid = keyBetween(keys[i - 1], keys[i]);
      expect(mid.length).toBeLessThanOrEqual(3);
    }
    expect(LONGEST_KEY).toBeGreaterThan(3);
  });
});
