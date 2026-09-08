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
   * Guards the save effect below. Without it, that effect fires once on mount
   * with the *empty* initial state and overwrites everything the user had.
   * This is the classic way persistence ships broken: it looks fine until you
   * already have data worth losing.
   */
  const hydrated = useRef(false);

  const hydrate = useCallback(() => {
    const stored = loadState();
    if (stored) dispatch({ type: 'HYDRATE', state: stored });
  }, []);

  // Before paint, so a returning user never sees a flash of the empty state.
  useIsomorphicLayoutEffect(() => {
    hydrate();
    hydrated.current = true;
  }, [hydrate]);

  useEffect(() => {
    if (!hydrated.current) return;
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
