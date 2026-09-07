'use client';

import { createContext, useContext, useMemo, useReducer } from 'react';
import type { Dispatch, ReactNode } from 'react';
import type { HabibitState } from '@/lib/types';
import { habibitReducer, initialState, type HabibitAction } from './reducer';

type HabibitContextValue = {
  state: HabibitState;
  dispatch: Dispatch<HabibitAction>;
};

const HabibitContext = createContext<HabibitContextValue | null>(null);

export function HabibitProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(habibitReducer, initialState);
  const value = useMemo(() => ({ state, dispatch }), [state]);
  return <HabibitContext.Provider value={value}>{children}</HabibitContext.Provider>;
}

export function useHabibit(): HabibitContextValue {
  const value = useContext(HabibitContext);
  if (!value) throw new Error('useHabibit must be used inside <HabibitProvider>');
  return value;
}
