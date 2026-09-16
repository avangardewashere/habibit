'use client';

import { useSyncExternalStore } from 'react';
import { getSupabase } from '@/lib/supabase/client';

export type AccountState =
  /** Accounts are switched off in this build, or we are on the server. */
  | { status: 'unavailable' }
  /** The stored session has not been read yet. Lasts a moment on load. */
  | { status: 'loading' }
  | { status: 'signed-out' }
  | { status: 'signed-in'; email: string };

const UNAVAILABLE: AccountState = { status: 'unavailable' };
const LOADING: AccountState = { status: 'loading' };
const SIGNED_OUT: AccountState = { status: 'signed-out' };

/*
 * A tiny external store over Supabase's auth events, read with
 * useSyncExternalStore like the theme and today's date. One subscription is
 * shared by every component that asks, and the snapshot object only changes when
 * the account actually changes, so React re-renders only then.
 */
let snapshot: AccountState = LOADING;
const listeners = new Set<() => void>();
let started = false;

function start() {
  const supabase = getSupabase();
  if (started || !supabase) return;
  started = true;

  // Fires once straight away with the stored session (INITIAL_SESSION), then on
  // every sign-in, sign-out and token refresh — including ones made in other tabs.
  supabase.auth.onAuthStateChange((_event, session) => {
    const email = session?.user.email ?? null;
    const next: AccountState = email ? { status: 'signed-in', email } : SIGNED_OUT;

    const same =
      next.status === snapshot.status &&
      (next.status !== 'signed-in' || (snapshot.status === 'signed-in' && snapshot.email === next.email));
    if (same) return;

    snapshot = next;
    listeners.forEach((notify) => notify());
  });
}

function subscribe(notify: () => void): () => void {
  listeners.add(notify);
  start();
  return () => listeners.delete(notify);
}

function getSnapshot(): AccountState {
  return getSupabase() ? snapshot : UNAVAILABLE;
}

// The server cannot know who is signed in, so it renders as if accounts were off.
const getServerSnapshot = (): AccountState => UNAVAILABLE;

export function useAccount(): AccountState {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}
