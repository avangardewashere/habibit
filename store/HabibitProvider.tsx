'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useReducer, useRef, useState } from 'react';
import type { Dispatch, ReactNode } from 'react';
import { useIsomorphicLayoutEffect } from '@/lib/useIsomorphicLayoutEffect';
import { loadState, saveState, STORAGE_KEY } from '@/lib/storage';
import type { HabibitState } from '@/lib/types';
import { habibitReducer, initialState, type HabibitAction } from './reducer';

type HabibitContextValue = {
  state: HabibitState;
  dispatch: Dispatch<HabibitAction>;
  /** True once a write to storage has failed, so the UI can stop pretending. */
  saveFailed: boolean;
};

const HabibitContext = createContext<HabibitContextValue | null>(null);

export function HabibitProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(habibitReducer, initialState);
  const [saveFailed, setSaveFailed] = useState(false);

  /**
   * The exact state object that storage currently holds — either what we just
   * read out of it, or what we last wrote into it. Compared by reference.
   */
  const persisted = useRef<HabibitState | null>(null);

  const hydrate = useCallback(() => {
    const stored = loadState();
    if (!stored) return;
    // Recorded *before* dispatching, so the save effect below can tell that this
    // state came out of storage and does not need writing back.
    persisted.current = stored;
    dispatch({ type: 'HYDRATE', state: stored });
  }, []);

  // Before paint, so a returning user never sees a flash of the empty state.
  useIsomorphicLayoutEffect(() => {
    hydrate();
  }, [hydrate]);

  useEffect(() => {
    /*
     * Two guards, both by object identity rather than by a "have we hydrated
     * yet" flag. A flag is not enough: the save effect belonging to the very
     * first render closes over the empty `initialState`, and can still run
     * after the flag has been set — React StrictMode does this every time, and
     * concurrent rendering can do it in production. That wipes real data.
     * Deriving the decision from the state itself removes the race entirely.
     */

    // Nothing has happened yet. `initialState` is a module constant, so this is
    // only ever true before the first hydrate or edit.
    if (state === initialState) return;

    // This state came *from* storage, so writing it back would be a no-op — and
    // in the multi-tab case an endless write/notify/write loop between tabs.
    if (state === persisted.current) return;

    persisted.current = state;
    setSaveFailed(!saveState(state));
  }, [state]);

  /**
   * Another tab wrote. Without this, two open tabs each hold stale state and
   * silently clobber each other — a real way to lose habits on desktop.
   */
  useEffect(() => {
    function onStorage(event: StorageEvent) {
      if (event.key !== null && event.key !== STORAGE_KEY) return;
      hydrate();
    }
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, [hydrate]);

  const value = useMemo(() => ({ state, dispatch, saveFailed }), [state, saveFailed]);

  return <HabibitContext.Provider value={value}>{children}</HabibitContext.Provider>;
}

export function useHabibit(): HabibitContextValue {
  const value = useContext(HabibitContext);
  if (!value) throw new Error('useHabibit must be used inside <HabibitProvider>');
  return value;
}
