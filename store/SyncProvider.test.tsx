// @vitest-environment jsdom
import { act, render, screen, waitFor } from '@testing-library/react';
import { StrictMode, useEffect } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Changes } from '@/lib/sync/merge';
import type { RemoteStore } from '@/lib/sync/remote';
import type { HabibitState } from '@/lib/types';
import { STORAGE_KEY } from '@/lib/storage';

vi.mock('@/lib/auth/session', () => ({ useAccount: () => ({ status: 'signed-in', email: 'me@example.com' }) }));
const signOut = vi.fn();
vi.mock('@/lib/auth/actions', () => ({ signOut: () => signOut() }));

import { HabibitProvider, useHabibit } from './HabibitProvider';
import { SyncProvider, useSync } from './SyncProvider';

const T = (minute: number) => new Date(Date.UTC(2026, 8, 17, 8, minute)).toISOString();
const account: HabibitState = {
  habits: [{ id: 'h-account', title: 'From account', createdAt: T(0), updatedAt: T(1), archivedAt: null, deletedAt: null }],
  tasks: [],
  completions: {},
};

/** An account whose replies the test releases by hand, to create exact timings. */
function controlledRemote(data: HabibitState) {
  let release!: () => void;
  let fail = false;
  const gate = () =>
    new Promise<void>((resolve, reject) => {
      release = () => (fail ? reject(new Error('offline')) : resolve());
    });
  const pushed: Changes[] = [];
  let pulls = 0;
  const remote: RemoteStore = {
    async pullSince() {
      pulls += 1;
      await gate();
      return { state: structuredClone(data), cursor: null };
    },
    async push(changes) {
      pushed.push(changes);
    },
  };
  return {
    remote,
    pushed,
    release: () => act(async () => release()),
    /** How many times the account has been asked for its data so far. */
    pulls: () => pulls,
    failNext: () => {
      fail = true;
    },
  };
}

type Api = ReturnType<typeof useHabibit> & ReturnType<typeof useSync>;
let api: Api;
function Probe() {
  const habibit = useHabibit();
  const sync = useSync();
  useEffect(() => {
    api = { ...habibit, ...sync };
  });
  return (
    <div>
      <span data-testid="habits">{habibit.state.habits.map((h) => h.title).join(',')}</span>
      <span data-testid="status">{sync.status.state}</span>
    </div>
  );
}

function renderWith(remote: RemoteStore) {
  render(
    <StrictMode>
      <HabibitProvider>
        <SyncProvider createRemote={() => remote}>
          <Probe />
        </SyncProvider>
      </HabibitProvider>
    </StrictMode>,
  );
}

const habits = () => screen.getByTestId('habits').textContent;
const status = () => screen.getByTestId('status').textContent;

beforeEach(() => {
  window.localStorage.clear();
  signOut.mockReset().mockResolvedValue({ ok: true });
});
afterEach(() => window.localStorage.clear());

describe('SyncProvider', () => {
  it('V2D-30 · signing in brings the account’s habits onto the device, after the upload succeeds', async () => {
    const account$ = controlledRemote(account);
    renderWith(account$.remote);

    await waitFor(() => expect(status()).toBe('syncing'));
    expect(habits()).toBe('');

    await account$.release();

    await waitFor(() => expect(habits()).toBe('From account'));
    expect(status()).toBe('synced');
  });

  it('V2D-31 · ⭐ an edit made WHILE a sync is running is not lost when the sync lands', async () => {
    const account$ = controlledRemote(account);
    renderWith(account$.remote);
    await waitFor(() => expect(status()).toBe('syncing'));

    act(() => api.dispatch({ type: 'ADD_HABIT', title: 'Added mid-sync' }));
    await account$.release();

    await waitFor(() => expect(habits()).toContain('From account'));
    expect(habits()).toContain('Added mid-sync');
  });

  it('V2D-32 · ⭐ a failed sync changes nothing on the device and says so', async () => {
    window.localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        version: 2,
        state: {
          habits: [{ id: 'h-device', title: 'On device', createdAt: T(0), updatedAt: T(0), archivedAt: null, deletedAt: null }],
          tasks: [],
          completions: {},
        },
      }),
    );
    const account$ = controlledRemote(account);
    account$.failNext();
    renderWith(account$.remote);

    await waitFor(() => expect(status()).toBe('syncing'));
    await account$.release();

    await waitFor(() => expect(status()).toBe('error'));
    expect(habits()).toBe('On device');
    expect(account$.pushed).toEqual([]);
  });

  it('V2D-33 · ⭐ a sync still in flight when the device is cleared does not bring the data back', async () => {
    const account$ = controlledRemote(account);
    renderWith(account$.remote);
    await waitFor(() => expect(status()).toBe('syncing'));

    // Sign out without waiting (as after the "sign out anyway" warning), then let the old sync land.
    await act(async () => {
      await api.signOutAndClear({ force: true });
    });
    await account$.release();

    expect(habits()).toBe('');
    expect(JSON.parse(window.localStorage.getItem(STORAGE_KEY)!).state.habits).toEqual([]);
  });

  it('V2D-34 · ⭐ signing out refuses to clear the device if the account could not be reached', async () => {
    const account$ = controlledRemote({ habits: [], tasks: [], completions: {} });
    renderWith(account$.remote);
    await waitFor(() => expect(status()).toBe('syncing'));
    await account$.release();
    await waitFor(() => expect(status()).toBe('synced'));

    act(() => api.dispatch({ type: 'ADD_HABIT', title: 'Not uploaded yet' }));
    account$.failNext();

    // Start signing out, wait until it is actually asking the account, then let that fail.
    let attempt!: Promise<boolean>;
    act(() => {
      attempt = api.signOutAndClear();
    });
    await waitFor(() => expect(account$.pulls()).toBe(2));
    await account$.release();
    let done: boolean | undefined;
    await act(async () => {
      done = await attempt;
    });

    expect(done).toBe(false);
    expect(signOut).not.toHaveBeenCalled();
    expect(habits()).toBe('Not uploaded yet');
  });

  it('V2D-35 · signing out after a good sync clears the device, and the clear is saved', async () => {
    const account$ = controlledRemote(account);
    renderWith(account$.remote);
    await waitFor(() => expect(status()).toBe('syncing'));
    await account$.release();
    await waitFor(() => expect(habits()).toBe('From account'));

    let attempt!: Promise<boolean>;
    act(() => {
      attempt = api.signOutAndClear();
    });
    await waitFor(() => expect(account$.pulls()).toBe(2));
    await account$.release();
    let done: boolean | undefined;
    await act(async () => {
      done = await attempt;
    });

    expect(done).toBe(true);
    expect(signOut).toHaveBeenCalledTimes(1);
    expect(habits()).toBe('');
    expect(JSON.parse(window.localStorage.getItem(STORAGE_KEY)!).state.habits).toEqual([]);
  });
});
