// @vitest-environment jsdom
import { act, render, screen, waitFor } from '@testing-library/react';
import { useEffect, useSyncExternalStore } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { isSampleId, sampleState } from '@/lib/sample';
import { STORAGE_KEY } from '@/lib/storage';
import type { Changes } from '@/lib/sync/merge';
import type { RemoteStore } from '@/lib/sync/remote';
import type { HabibitState } from '@/lib/types';

/*
 * v5 Block C: sample habits never reach an account.
 *
 * Your choice at the start of the block: signing in clears them, so an
 * account only ever holds habits someone actually keeps. And because a
 * made-up habit in a real account is the one outcome that can't be quietly
 * undone, the sync layer also refuses to carry them — even in the moment
 * between, or in a tab that still had them.
 *
 * The account starts signed **out** and signs in once the app is open — the
 * story being tested, and also how the real session behaves: it starts as
 * "loading" and Supabase reports it a moment later, after the device has
 * loaded from storage. A mock that is signed in from the very first render
 * would run the opening sync against an empty device, which the app never
 * does (found while writing V5C-31; lib/auth/session.ts).
 */

const session = vi.hoisted(() => {
  let current: { status: 'signed-out' } | { status: 'signed-in'; email: string } = { status: 'signed-out' };
  const listeners = new Set<() => void>();
  return {
    get: () => current,
    subscribe: (fn: () => void) => (listeners.add(fn), () => void listeners.delete(fn)),
    signIn: () => {
      current = { status: 'signed-in', email: 'me@example.com' };
      listeners.forEach((fn) => fn());
    },
    reset: () => {
      current = { status: 'signed-out' };
    },
  };
});
vi.mock('@/lib/auth/session', () => ({
  useAccount: () => useSyncExternalStore(session.subscribe, session.get, session.get),
}));
vi.mock('@/lib/auth/actions', () => ({ signOut: vi.fn() }));

import { HabibitProvider, useHabibit } from './HabibitProvider';
import { SyncProvider, useSync } from './SyncProvider';

const TODAY = '2026-10-07';
const MINE = {
  id: '11111111-2222-4333-8444-555555555555',
  title: 'Mine',
  createdAt: '2026-10-01T00:00:00.000Z',
  updatedAt: '2026-10-01T00:00:00.000Z',
  archivedAt: null,
  deletedAt: null,
  position: null,
  schedule: null,
  icon: null,
  colour: null,
};

/** An empty account that remembers everything it was sent. */
function recordingRemote() {
  const pushed: Changes[] = [];
  const remote: RemoteStore = {
    async pullSince() {
      return { state: { habits: [], tasks: [], completions: {} }, cursor: null };
    },
    async push(changes) {
      pushed.push(structuredClone(changes));
    },
  };
  /** Every id that has gone up, from every push. */
  const sentIds = () =>
    pushed.flatMap((c) => [
      ...c.habits.map((h) => h.id),
      ...c.tasks.map((t) => t.id),
      ...c.completions.map(([key]) => key.slice(0, key.lastIndexOf('::'))),
    ]);
  return { remote, pushed, sentIds };
}

type Api = ReturnType<typeof useHabibit> & ReturnType<typeof useSync>;
let api: Api;
function Probe() {
  const habibit = useHabibit();
  const sync = useSync();
  useEffect(() => {
    api = { ...habibit, ...sync };
  });
  return <span data-testid="status">{sync.status.state}</span>;
}

function renderWith(remote: RemoteStore) {
  render(
    <HabibitProvider>
      <SyncProvider createRemote={() => remote}>
        <Probe />
      </SyncProvider>
    </HabibitProvider>,
  );
}

function storeOnDevice(state: HabibitState) {
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify({ version: 2, state }));
}

beforeEach(() => {
  window.localStorage.clear();
  session.reset();
});

/** Opens the app signed out, then signs in — and waits for the first sync. */
async function openThenSignIn(remote: RemoteStore) {
  renderWith(remote);
  act(() => session.signIn());
  await waitFor(() => expect(screen.getByTestId('status').textContent).toBe('synced'));
}
afterEach(() => window.localStorage.clear());

describe('V5C: the sample and an account', () => {
  it('V5C-30 · ⭐ signing in clears the sample, and only the sample', async () => {
    const sample = sampleState(TODAY);
    storeOnDevice({ habits: [MINE, ...sample.habits], tasks: sample.tasks, completions: sample.completions });
    const account = recordingRemote();
    await openThenSignIn(account.remote);

    expect(api.state.habits.map((h) => h.title)).toEqual(['Mine']);
    expect(api.state.tasks).toEqual([]);
    expect(Object.keys(api.state.completions).some(isSampleId)).toBe(false);
  });

  it('V5C-31 · ⭐ nothing from the sample is ever uploaded — your own habit is', async () => {
    const sample = sampleState(TODAY);
    storeOnDevice({ habits: [MINE, ...sample.habits], tasks: sample.tasks, completions: sample.completions });
    const account = recordingRemote();
    await openThenSignIn(account.remote);

    expect(account.sentIds()).toContain(MINE.id);
    expect(account.sentIds().filter(isSampleId)).toEqual([]);
  });

  it('V5C-32 · ⭐ even if a sample appears while signed in, editing it uploads nothing and waits for nothing', async () => {
    // Not something the app offers — the welcome hides the button once you
    // are signed in — but a second tab or an odd moment could still get here.
    const account = recordingRemote();
    await openThenSignIn(account.remote);

    act(() => api.dispatch({ type: 'LOAD_SAMPLE', today: TODAY }));
    const sampleHabit = api.state.habits.find((h) => isSampleId(h.id))!;
    act(() => api.dispatch({ type: 'RENAME_HABIT', id: sampleHabit.id, title: 'Renamed sample' }));
    act(() => api.dispatch({ type: 'TOGGLE_COMPLETION', habitId: sampleHabit.id, dateKey: TODAY }));
    await act(async () => {
      await api.syncNow();
    });

    // The pending count would sit at one for ever if a sample edit had queued.
    expect(api.pending).toBe(0);
    expect(account.sentIds().filter(isSampleId)).toEqual([]);
  });

  it('V5C-33 · with no sample on the device, signing in changes nothing locally', async () => {
    storeOnDevice({ habits: [MINE], tasks: [], completions: {} });
    const account = recordingRemote();
    await openThenSignIn(account.remote);
    expect(api.state.habits.map((h) => h.title)).toEqual(['Mine']);
  });
});
