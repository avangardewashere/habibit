'use client';

import { useSyncExternalStore } from 'react';
import {
  applyTheme,
  loadThemePreference,
  saveThemePreference,
  type ThemePreference,
} from './theme';

/**
 * The preference is read from storage once and then kept here, so every
 * component sees the same value and a change re-renders all of them.
 */
let cached: ThemePreference | null = null;
const listeners = new Set<() => void>();

function subscribe(onChange: () => void): () => void {
  listeners.add(onChange);
  // Also react to the OS flipping while the app is open, which matters when the
  // preference is `system`.
  const query = window.matchMedia('(prefers-color-scheme: dark)');
  query.addEventListener('change', onChange);

  return () => {
    listeners.delete(onChange);
    query.removeEventListener('change', onChange);
  };
}

function getPreferenceSnapshot(): ThemePreference {
  if (cached === null) cached = loadThemePreference();
  return cached;
}

// The server cannot know either the stored choice or the device, so it commits
// to the default. The inline script has already painted the right colours.
const getPreferenceServerSnapshot = (): ThemePreference => 'system';

export function setThemePreference(next: ThemePreference): void {
  cached = next;
  saveThemePreference(next);
  applyTheme(next);
  listeners.forEach((listener) => listener());
}

/** What the user picked: light, dark, or follow the device. */
export function useThemePreference(): ThemePreference {
  return useSyncExternalStore(
    subscribe,
    getPreferenceSnapshot,
    getPreferenceServerSnapshot,
  );
}

