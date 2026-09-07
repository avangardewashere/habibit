'use client';

import { useSyncExternalStore } from 'react';
import { dateKey } from './date';
import type { DateKey } from './types';

/**
 * Re-reads the day at local midnight, and whenever the tab becomes visible
 * again — a phone that slept through midnight fires no timer, so the
 * visibility check is what actually catches the rollover in practice.
 */
function subscribe(onChange: () => void): () => void {
  let timer: ReturnType<typeof setTimeout>;

  const scheduleMidnight = () => {
    const now = new Date();
    // One second past midnight, so we are unambiguously on the next day.
    const nextMidnight = new Date(
      now.getFullYear(),
      now.getMonth(),
      now.getDate() + 1,
      0,
      0,
      1,
    );
    timer = setTimeout(() => {
      onChange();
      scheduleMidnight();
    }, nextMidnight.getTime() - now.getTime());
  };

  scheduleMidnight();
  document.addEventListener('visibilitychange', onChange);

  return () => {
    clearTimeout(timer);
    document.removeEventListener('visibilitychange', onChange);
  };
}

// A plain string, so React's Object.is check settles when the day is unchanged.
const getSnapshot = (): DateKey | null => dateKey(new Date());

// The server cannot know the visitor's timezone, so it commits to nothing.
const getServerSnapshot = (): DateKey | null => null;

/**
 * Today's local date key, or `null` on the server and during hydration.
 * The single source of "what day is it" for the whole client.
 */
export function useToday(): DateKey | null {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}
