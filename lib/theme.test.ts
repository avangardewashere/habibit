import { afterEach, describe, expect, it } from 'vitest';
import {
  THEME_COLOURS,
  THEME_INIT_SCRIPT,
  THEME_KEY,
  isThemePreference,
  loadThemePreference,
  saveThemePreference,
} from './theme';

function memoryStorage(): Storage {
  const map = new Map<string, string>();
  return {
    get length() {
      return map.size;
    },
    key: (i) => [...map.keys()][i] ?? null,
    getItem: (k) => map.get(k) ?? null,
    setItem: (k, v) => void map.set(k, String(v)),
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

describe('isThemePreference', () => {
  it('accepts only the three known values', () => {
    expect(isThemePreference('light')).toBe(true);
    expect(isThemePreference('dark')).toBe(true);
    expect(isThemePreference('system')).toBe(true);
  });

  it('rejects anything else', () => {
    for (const value of [null, undefined, '', 'DARK', 'auto', 0, {}]) {
      expect(isThemePreference(value)).toBe(false);
    }
  });
});

describe('loading and saving the preference', () => {
  it('round-trips an explicit choice', () => {
    useStorage(memoryStorage());
    saveThemePreference('dark');
    expect(loadThemePreference()).toBe('dark');
  });

  it('stores "system" as the absence of a key, not the string', () => {
    const store = memoryStorage();
    useStorage(store);

    saveThemePreference('dark');
    expect(store.getItem(THEME_KEY)).toBe('dark');

    saveThemePreference('system');
    expect(store.getItem(THEME_KEY)).toBeNull();
    expect(loadThemePreference()).toBe('system');
  });

  it('falls back to system when nothing is stored', () => {
    useStorage(memoryStorage());
    expect(loadThemePreference()).toBe('system');
  });

  it('falls back to system when the stored value is junk', () => {
    const store = memoryStorage();
    useStorage(store);
    store.setItem(THEME_KEY, 'chartreuse');
    expect(loadThemePreference()).toBe('system');
  });

  it('does not throw when there is no storage at all (server render)', () => {
    useStorage(undefined);
    expect(loadThemePreference()).toBe('system');
    expect(() => saveThemePreference('dark')).not.toThrow();
  });
});

describe('the pre-paint init script', () => {
  it('reads the same key the app writes', () => {
    expect(THEME_INIT_SCRIPT).toContain(THEME_KEY);
  });

  it('only ever sets an explicit theme, never "system"', () => {
    expect(THEME_INIT_SCRIPT).toContain("t==='light'");
    expect(THEME_INIT_SCRIPT).toContain("t==='dark'");
    expect(THEME_INIT_SCRIPT).not.toContain("'system'");
  });

  it('is wrapped in try/catch, because storage access itself can throw', () => {
    expect(THEME_INIT_SCRIPT).toMatch(/^try\{/);
    expect(THEME_INIT_SCRIPT).toContain('catch');
  });

  it('cannot break out of the inline script tag', () => {
    expect(THEME_INIT_SCRIPT.toLowerCase()).not.toContain('</script');
  });
});

describe('status bar colours', () => {
  it('has one for each resolved theme', () => {
    expect(THEME_COLOURS.light).toMatch(/^#[0-9A-Fa-f]{6}$/);
    expect(THEME_COLOURS.dark).toMatch(/^#[0-9A-Fa-f]{6}$/);
    expect(THEME_COLOURS.light).not.toBe(THEME_COLOURS.dark);
  });
});
