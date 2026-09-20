'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { deleteAccount as deleteTheAccount, signOut as signOutOfAccount } from '@/lib/auth/actions';
import { useAccount } from '@/lib/auth/session';
import { isOnline } from '@/lib/offline/connection';
import { getSupabase } from '@/lib/supabase/client';
import { supabaseRemote, type RemoteStore } from '@/lib/sync/remote';
import {
  collectChanges,
  outboxKeysFor,
  syncChanges,
  syncOnce,
  touchedBy,
  type OutboxKey,
  type SyncResult,
} from '@/lib/sync/sync';
import type { HabibitState } from '@/lib/types';
import { useHabibit } from './HabibitProvider';

export type SyncStatus =
  /** Signed out, or accounts are switched off. */
  | { state: 'off' }
  | { state: 'syncing' }
  | { state: 'synced'; at: Date }
  /** `offline` means the browser has no connection at all: expected, not a fault. */
  | { state: 'error'; message: string; offline: boolean };

type SyncContextValue = {
  status: SyncStatus;
  /** Edits on this device the account hasn't confirmed yet. */
  pending: number;
  /** Runs a sync now. Resolves `true` only if it fully succeeded. */
  syncNow: () => Promise<boolean>;
  /**
   * Signs out and empties this device. Unless `force` is set, first makes sure
   * the account has everything, and resolves `false` without signing out if it
   * couldn't — so the caller can warn before anything is lost.
   */
  signOutAndClear: (options?: { force?: boolean }) => Promise<boolean>;
  /**
   * Deletes the account and stops syncing, **keeping this device's habits**.
   * Resolves the reason it couldn't, or `null` if it did.
   */
  deleteAccountKeepingDevice: () => Promise<string | null>;
};

/*
 * A harmless default, so components that show sync status (the account button)
 * still render on their own, e.g. in a test or a build without accounts.
 */
const SyncContext = createContext<SyncContextValue>({
  status: { state: 'off' },
  pending: 0,
  syncNow: async () => false,
  signOutAndClear: async () => false,
  deleteAccountKeepingDevice: async () => 'Accounts are not available right now.',
});

/** Your choice: an open app checks for changes this often, while it's visible. */
export const POLL_MS = 30_000;
/** Edits in quick succession (ticking several habits) go up together. */
export const EDIT_DEBOUNCE_MS = 1_500;

/** Shown when the browser has no connection: nothing is wrong, and nothing is lost. */
export const OFFLINE_MESSAGE = 'You’re offline. Your habits are safe on this device and will sync when you’re back.';
/** Shown when there is a connection but the account couldn’t be reached. */
export const UNREACHABLE_MESSAGE =
  'Couldn’t reach your account. Your habits are safe on this device and will sync when it’s back.';

function updatedAtOf(state: HabibitState, key: OutboxKey): string | undefined {
  const c = collectChanges(state, [key]);
  return c.habits[0]?.updatedAt ?? c.tasks[0]?.updatedAt ?? c.completions[0]?.[1].updatedAt;
}

/**
 * Keeps this device and the signed-in account in step.
 *
 * - **Opening the app or signing in** does the full combine from Block D. It is
 *   the safety net: anything a closed tab never uploaded is caught here.
 * - **While the app is open**, small syncs: edits go up shortly after they're
 *   made, and changes from other devices come down every 30 seconds while the app
 *   is visible, and whenever it comes back into view.
 *
 * Nothing on the device changes unless a sync succeeds, and even then the result
 * is merged into the device's *current* data, so an edit made mid-sync survives.
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
  const { state, mergeRemote, clearDevice, subscribeToEdits } = useHabibit();
  const [status, setStatus] = useState<SyncStatus>({ state: 'off' });
  const [pending, setPending] = useState(0);

  const signedIn = account.status === 'signed-in';

  // The latest device data, read when a sync starts rather than captured by a closure.
  const latest = useRef(state);
  useEffect(() => {
    latest.current = state;
  }, [state]);

  const outbox = useRef(new Map<OutboxKey, true>());
  /** The account's server time up to which this device has seen everything. `null` until a full combine. */
  const cursor = useRef<string | null>(null);
  /*
   * Bumped on sign-out. A sync that was already in flight when the device was
   * cleared must not pour the account's data back onto it when it finishes.
   */
  const generation = useRef(0);
  const inFlight = useRef<Promise<boolean> | null>(null);
  const createRemoteRef = useRef(createRemote);
  /** The current `run`, for the follow-up sync it schedules for itself. */
  const runRef = useRef<((kind: 'full' | 'small') => Promise<boolean>) | null>(null);

  const run = useCallback(
    (kind: 'full' | 'small'): Promise<boolean> => {
      if (inFlight.current) return inFlight.current;
      const remote = createRemoteRef.current();
      if (!remote) return Promise.resolve(false);

      const startedIn = generation.current;
      setStatus({ state: 'syncing' });

      const work: Promise<SyncResult> =
        kind === 'full'
          ? syncOnce(latest.current, remote)
          : syncChanges(latest.current, outbox.current.keys(), cursor.current, remote);

      const attempt = work
        .then((result) => {
          if (generation.current !== startedIn) return false;
          mergeRemote(result.merged);
          cursor.current = result.cursor ?? cursor.current;

          // Tick off only what was sent unchanged. An edit made while this sync
          // was running has a newer updatedAt, so it stays for the next one.
          const sent = outboxKeysFor(result.pushed);
          for (const key of [...outbox.current.keys()]) {
            const now = updatedAtOf(latest.current, key);
            const sentAt = sent.get(key) ?? (kind === 'full' ? updatedAtOf(result.merged, key) : undefined);
            // A record that no longer exists here has nothing left to send.
            if (now === undefined || sentAt === now) outbox.current.delete(key);
          }
          setPending(outbox.current.size);
          setStatus({ state: 'synced', at: new Date() });
          // Edits made while this sync was running are still waiting: send them now.
          if (outbox.current.size > 0) setTimeout(() => void runRef.current?.('small'), 0);
          return true;
        })
        .catch(() => {
          if (generation.current !== startedIn) return false;
          const offline = !isOnline();
          setStatus({ state: 'error', message: offline ? OFFLINE_MESSAGE : UNREACHABLE_MESSAGE, offline });
          return false;
        })
        .finally(() => {
          inFlight.current = null;
        });

      inFlight.current = attempt;
      return attempt;
    },
    [mergeRemote],
  );

  useEffect(() => {
    runRef.current = run;
  }, [run]);

  const syncNow = useCallback(() => run(cursor.current === null ? 'full' : 'small'), [run]);

  // Sign-in, or opening the app already signed in: the full combine.
  useEffect(() => {
    if (!signedIn) return;
    void run('full');
  }, [signedIn, run]);

  // Every edit on this device goes in the outbox, and up shortly after.
  useEffect(() => {
    if (!signedIn) return;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const unsubscribe = subscribeToEdits((action) => {
      const key = touchedBy(action);
      if (!key) return;
      outbox.current.set(key, true);
      setPending(outbox.current.size);
      clearTimeout(timer);
      timer = setTimeout(() => void syncNow(), EDIT_DEBOUNCE_MS);
    });
    return () => {
      clearTimeout(timer);
      unsubscribe();
    };
  }, [signedIn, subscribeToEdits, syncNow]);

  // Changes from other devices: every 30 seconds while visible, and on coming back into view.
  useEffect(() => {
    if (!signedIn) return;
    const poll = setInterval(() => {
      if (document.visibilityState === 'visible') void syncNow();
    }, POLL_MS);
    function onVisible() {
      if (document.visibilityState === 'visible') void syncNow();
    }
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      clearInterval(poll);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [signedIn, syncNow]);

  // Coming back from offline shouldn't wait up to 30 seconds to be noticed.
  useEffect(() => {
    if (!signedIn) return;
    function onOnline() {
      void syncNow();
    }
    window.addEventListener('online', onOnline);
    return () => window.removeEventListener('online', onOnline);
  }, [signedIn, syncNow]);

  const signOutAndClear = useCallback(
    async ({ force = false }: { force?: boolean } = {}): Promise<boolean> => {
      if (!force) {
        // Wait out any sync already running, then make sure the account has everything.
        await inFlight.current;
        if (!(await syncNow()) || outbox.current.size > 0) return false;
      }

      generation.current += 1;
      const result = await signOutOfAccount();
      if (!result.ok) {
        setStatus({ state: 'error', message: result.message, offline: false });
        return false;
      }
      outbox.current.clear();
      cursor.current = null;
      setPending(0);
      clearDevice();
      setStatus({ state: 'off' });
      return true;
    },
    [syncNow, clearDevice],
  );

  /*
   * Deleting is the mirror image of signing out: sign-out keeps the account and
   * empties the device, this keeps the device and empties the account.
   *
   * Nothing is synced first, on purpose. Sign-out pushes any last changes up so
   * they aren't lost — here the place they would be pushed to is about to stop
   * existing, and the copy that matters is the one staying on this device.
   *
   * The generation bump and the cleared outbox matter more than they look: a
   * sync started a moment ago must not be allowed to finish and write a deleted
   * account's answer back into the device.
   */
  const deleteAccountKeepingDevice = useCallback(async (): Promise<string | null> => {
    const result = await deleteTheAccount();
    if (!result.ok) return result.message;

    generation.current += 1;
    outbox.current.clear();
    cursor.current = null;
    setPending(0);
    setStatus({ state: 'off' });
    return null;
  }, []);

  const value = useMemo<SyncContextValue>(
    () => ({
      status: signedIn ? status : { state: 'off' },
      pending: signedIn ? pending : 0,
      syncNow,
      signOutAndClear,
      deleteAccountKeepingDevice,
    }),
    [signedIn, status, pending, syncNow, signOutAndClear, deleteAccountKeepingDevice],
  );

  return <SyncContext.Provider value={value}>{children}</SyncContext.Provider>;
}

export function useSync(): SyncContextValue {
  return useContext(SyncContext);
}
