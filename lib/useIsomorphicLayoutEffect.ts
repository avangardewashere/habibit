'use client';

import { useEffect, useLayoutEffect } from 'react';

/**
 * `useLayoutEffect` in the browser, `useEffect` on the server.
 *
 * We need a layout effect so that state loaded from storage is applied *before*
 * the browser paints — otherwise a returning user sees a flash of "No habits
 * yet" before their habits appear. React warns about useLayoutEffect during
 * SSR, hence the swap.
 */
export const useIsomorphicLayoutEffect =
  typeof window === 'undefined' ? useEffect : useLayoutEffect;
