'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { UndoBar } from '@/components/ui/UndoBar';

/** Your choice: how long a delete can be taken back. */
export const UNDO_MS = 6_000;

type Offer = { id: number; message: string; undo: () => void };

type UndoContextValue = {
  /**
   * Shows the bar with `message`, and runs `undo` if it's tapped in time.
   * A new offer replaces the one showing: the earlier delete becomes final.
   */
  offer: (message: string, undo: () => void) => void;
};

// A harmless default, so a section rendered without the provider (a test, a
// preview) still works — it just has nothing to undo with.
const UndoContext = createContext<UndoContextValue>({ offer: () => {} });

/**
 * The timing half of undo. It decides when the bar shows and for how long;
 * UndoBar only draws it.
 *
 * **Nothing is deleted when the bar goes away.** The delete already happened —
 * as a soft delete, the moment it was tapped — and already synced. The bar is
 * only the window in which it can be reversed. So there is no "commit" step to
 * forget, and a closed tab mid-countdown loses nothing but the chance to undo.
 *
 * The countdown **pauses while the bar is hovered or focused.** A 6-second
 * window is fine to glance at, and hopeless to reach by keyboard or with a
 * screen reader if it can vanish mid-way. It restarts in full when released.
 */
export function UndoProvider({ children }: { children: ReactNode }) {
  const [current, setCurrent] = useState<Offer | null>(null);
  const [held, setHeld] = useState(false);
  const counter = useRef(0);

  const offer = useCallback((message: string, undo: () => void) => {
    counter.current += 1;
    setCurrent({ id: counter.current, message, undo });
    setHeld(false);
  }, []);

  // Restarts whenever a new offer arrives, or the bar is let go of.
  useEffect(() => {
    if (!current || held) return;
    const timer = setTimeout(() => setCurrent(null), UNDO_MS);
    return () => clearTimeout(timer);
  }, [current, held]);

  const value = useMemo(() => ({ offer }), [offer]);

  return (
    <UndoContext.Provider value={value}>
      {children}
      {current && (
        <UndoBar
          // A new offer is a new bar, so a screen reader announces it afresh.
          key={current.id}
          message={current.message}
          onUndo={() => {
            current.undo();
            setCurrent(null);
          }}
          onHold={() => setHeld(true)}
          onRelease={() => setHeld(false)}
        />
      )}
    </UndoContext.Provider>
  );
}

export function useUndo(): UndoContextValue {
  return useContext(UndoContext);
}
