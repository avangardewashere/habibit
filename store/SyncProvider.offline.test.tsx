// @vitest-environment jsdom
import { act, render, screen } from '@testing-library/react';
import { useEffect } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fakeAccount } from '@/test-support/fake-account';
import type { RemoteStore } from '@/lib/sync/remote';

vi.mock('@/lib/auth/session', () => ({ useAccount: () => ({ status: 'signed-in', email: 'me@example.com' }) }));
vi.mock('@/lib/auth/actions', () => ({ signOut: async () => ({ ok: true }) }));

import { HabibitProvider, useHabibit } from './HabibitProvider';
import { EDIT_DEBOUNCE_MS, OFFLINE_MESSAGE, POLL_MS, SyncProvider, UNREACHABLE_MESSAGE, useSync } from './SyncProvider';

/*
 * v2 Block F, in the app: knowing the difference between "no connection" and
 * "something is wrong", and catching up the moment the connection returns.
 */

let api: ReturnType<typeof useHabibit> & ReturnType<typeof useSync>;
function Probe() {
  const habibit = useHabibit();
  const sync = useSync();
  useEffect(() => {
    api = { ...habibit, ...sync };
  });
  return (
    <div>
      <span data-testid="status">{sync.status.state}</span>
      <span data-testid="message">{sync.status.state === 'error' ? sync.status.message : ''}</span>
      <span data-testid="pending">{sync.pending}</span>
    </div>
  );
}

const text = (id: string) => screen.getByTestId(id).textContent;
const wait = (ms: number) => act(async () => void (await vi.advanceTimersByTimeAsync(ms)));

function setConnected(connected: boolean) {
  Object.defineProperty(navigator, 'onLine', { configurable: true, get: () => connected });
  window.dispatchEvent(new Event(connected ? 'online' : 'offline'));
}

async function openApp(remote: RemoteStore) {
  render(
    <HabibitProvider>
      <SyncProvider createRemote={() => remote}>
        <Probe />
      </SyncProvider>
    </HabibitProvider>,
  );
  await wait(0); // the opening full sync
}

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'setInterval', 'clearInterval', 'Date'] });
  window.localStorage.clear();
  Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => 'visible' });
});
afterEach(() => {
  vi.useRealTimers();
  window.localStorage.clear();
  Reflect.deleteProperty(navigator, 'onLine');
});

describe('V2F: offline in the app', () => {
  it('V2F-10 · ⭐ with no connection, it says you’re offline rather than raising a fault', async () => {
    const account = fakeAccount();
    await openApp(account.remote());

    account.setOffline(true);
    setConnected(false);
    act(() => api.dispatch({ type: 'ADD_HABIT', title: 'Made on a train' }));
    await wait(EDIT_DEBOUNCE_MS + 100);

    expect(text('status')).toBe('error');
    expect(text('message')).toBe(OFFLINE_MESSAGE);
    expect(text('pending')).toBe('1');
  });

  it('V2F-11 · with a connection but no account, it says the account couldn’t be reached', async () => {
    const account = fakeAccount();
    await openApp(account.remote());

    account.setOffline(true); // the account is unreachable…
    setConnected(true); // …but this device has a perfectly good connection
    act(() => api.dispatch({ type: 'ADD_HABIT', title: 'Something' }));
    await wait(EDIT_DEBOUNCE_MS + 100);

    expect(text('message')).toBe(UNREACHABLE_MESSAGE);
  });

  it('V2F-12 · ⭐ the connection coming back syncs straight away, not at the next check', async () => {
    const account = fakeAccount();
    await openApp(account.remote());

    account.setOffline(true);
    setConnected(false);
    act(() => api.dispatch({ type: 'ADD_HABIT', title: 'Made offline' }));
    await wait(EDIT_DEBOUNCE_MS + 100);
    expect(account.snapshot().habits).toEqual([]);

    account.setOffline(false);
    setConnected(true);
    await wait(100); // far less than the 30-second check

    expect(account.snapshot().habits.map((h) => h.title)).toEqual(['Made offline']);
    expect(text('pending')).toBe('0');
    expect(text('status')).toBe('synced');
    expect(POLL_MS).toBeGreaterThan(1_000); // the point: this didn't wait for the poll
  });
});
