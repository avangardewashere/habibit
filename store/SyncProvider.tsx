'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { signOut as signOutOfAccount } from '@/lib/auth/actions';
import { useAccount } from '@/lib/auth/session';
import { getSupabase } from '@/lib/supabase/client';
import { supabaseRemote, type RemoteStore } from '@/lib/sync/remote';
import { syncOnce } from '@/lib/sync/sync';
import { useHabibit } from './HabibitProvider';

export type SyncStatus =
  /** Signed out, or accounts are switched off. */
  | { state: 'off' }
  | { state: 'syncing' }
  | { state: 'synced'; at: Date }
  | { state: 'error'; message: string };

type SyncContextValue = {
  status: SyncStatus;
  /** Runs a sync now. Resolves `true` only if this device and the account fully match. */
  syncNow: () => Promise<boolean>;
  /**
   * Signs out and empties this device. Unless `force` is set, first makes sure
   * the account has everything, and resolves `false` without signing out if it
   * couldn't — so the caller can warn before anything is lost.
   */
  signOutAndClear: (options?: { force?: boolean }) => Promise<boolean>;
};

const SyncContext = createContext<SyncContextValue | null>(null);

/** Don't sync again on every tab switch; once a minute is plenty until Block E. */
const REFOCUS_GAP_MS = 60_000;

const OFFLINE_MESSAGE = 'Couldn’t reach your account. Your habits are safe on this device and will sync next time.';

/**
 * Keeps this device and the signed-in account combined.
 *
 * Syncs when someone signs in, when the app opens already signed in, and when
 * it comes back to the foreground. It only ever *adds* the account's data to the
 * device through a merge, and only after the upload has succeeded.
 */
export function SyncProvider({
  children,
  createRemote = () => {
    const supabase = getSupabase();
    return supabase ? supabaseRemote(supabase) : null;
  },
}: {
  children: ReactNode;
  /** Swappable so tests can use an in-memory account. */
  createRemote?: () => RemoteStore | null;
}) {
  const account = useAccount();
  const { state, mergeRemote, clearDevice } = useHabibit();
  const [status, setStatus] = useState<SyncStatus>({ state: 'off' });

  const signedIn = account.status === 'signed-in';

  // The latest device data, read when a sync starts rather than captured by a closure.
  const latest = useRef(state);
  useEffect(() => {
    latest.current = state;
  }, [state]);

  /*
   * Bumped on sign-out. A sync that was already in flight when the device was
   * cleared must not pour the account's data back onto it when it finishes.
   */
  const generation = useRef(0);
  const inFlight = useRef<Promise<boolean> | null>(null);
  const lastSyncAt = useRef(0);
  const createRemoteRef = useRef(createRemote);

  const syncNow = useCallback((): Promise<boolean> => {
    if (inFlight.current) return inFlight.current;
    const remote = createRemoteRef.current();
    if (!remote) return Promise.resolve(false);

    const startedIn = generation.current;
    setStatus({ state: 'syncing' });

    const run = syncOnce(latest.current, remote)
      .then(({ merged }) => {
        if (generation.current !== startedIn) return false;
        mergeRemote(merged);
        lastSyncAt.current = Date.now();
        setStatus({ state: 'synced', at: new Date() });
        return true;
      })
      .catch(() => {
        if (generation.current !== startedIn) return false;
        setStatus({ state: 'error', message: OFFLINE_MESSAGE });
        return false;
      })
      .finally(() => {
        inFlight.current = null;
      });

    inFlight.current = run;
    return run;
  }, [mergeRemote]);

  // Sign-in, or opening the app while already signed in.
  useEffect(() => {
    if (!signedIn) return;
    void syncNow();
  }, [signedIn, syncNow]);

  // Coming back to the app: a phone resumes it rather than reopening it.
  useEffect(() => {
    if (!signedIn) return;
    function onVisible() {
      if (document.visibilityState === 'visible' && Date.now() - lastSyncAt.current > REFOCUS_GAP_MS) {
        void syncNow();
      }
    }
    document.addEventListener('visibilitychange', onVisible);
    return () => document.removeEventListener('visibilitychange', onVisible);
  }, [signedIn, syncNow]);

  const signOutAndClear = useCallback(
    async ({ force = false }: { force?: boolean } = {}): Promise<boolean> => {
      if (!force) {
        // Wait out any sync already running, then make sure the account is fully up to date.
        await inFlight.current;
        if (!(await syncNow())) return false;
      }

      generation.current += 1;
      const result = await signOutOfAccount();
      if (!result.ok) {
        setStatus({ state: 'error', message: result.message });
        return false;
      }
      clearDevice();
      setStatus({ state: 'off' });
      return true;
    },
    [syncNow, clearDevice],
  );

  const value = useMemo<SyncContextValue>(
    () => ({ status: signedIn ? status : { state: 'off' }, syncNow, signOutAndClear }),
    [signedIn, status, syncNow, signOutAndClear],
  );

  return <SyncContext.Provider value={value}>{children}</SyncContext.Provider>;
}

export function useSync(): SyncContextValue {
  const value = useContext(SyncContext);
  if (!value) throw new Error('useSync must be used inside <SyncProvider>');
  return value;
}
