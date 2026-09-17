// @vitest-environment jsdom
import { act, render, screen } from '@testing-library/react';
import { useEffect } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fakeAccount } from '@/test-support/fake-account';
import type { RemoteStore } from '@/lib/sync/remote';

vi.mock('@/lib/auth/session', () => ({ useAccount: () => ({ status: 'signed-in', email: 'me@example.com' }) }));
vi.mock('@/lib/auth/actions', () => ({ signOut: async () => ({ ok: true }) }));

import { HabibitProvider, useHabibit } from './HabibitProvider';
import { EDIT_DEBOUNCE_MS, POLL_MS, SyncProvider, useSync } from './SyncProvider';

/*
 * Block E, in the app: edits go up shortly after they're made, and changes from
 * other devices come down every 30 seconds while the app is visible.
 *
 * Timers are faked, so "30 seconds" is exact and the tests take milliseconds.
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
      <span data-testid="habits">{habibit.state.habits.filter((h) => !h.deletedAt).map((h) => h.title).join(',')}</span>
      <span data-testid="status">{sync.status.state}</span>
      <span data-testid="pending">{sync.pending}</span>
    </div>
  );
}

const text = (id: string) => screen.getByTestId(id).textContent;

/** Lets the fake timers run for `ms`, including every promise they start. */
const wait = (ms: number) => act(async () => void (await vi.advanceTimersByTimeAsync(ms)));

function setVisible(visible: boolean) {
  Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => (visible ? 'visible' : 'hidden') });
  document.dispatchEvent(new Event('visibilitychange'));
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

/** Another device writing to the same account. */
async function otherDeviceAdds(account: ReturnType<typeof fakeAccount>, title: string) {
  const now = new Date().toISOString();
  await account.remote().push({
    habits: [{ id: `other-${title}`, title, createdAt: now, updatedAt: now, archivedAt: null, deletedAt: null }],
    tasks: [],
    completions: [],
  });
}

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'setInterval', 'clearInterval', 'Date'] });
  window.localStorage.clear();
  setVisible(true);
});
afterEach(() => {
  vi.useRealTimers();
  window.localStorage.clear();
});

describe('V2E: live sync in the app', () => {
  it('V2E-30 · ⭐ an edit reaches the account shortly after it is made, with no reload', async () => {
    const account = fakeAccount();
    await openApp(account.remote());
    expect(text('status')).toBe('synced');

    act(() => api.dispatch({ type: 'ADD_HABIT', title: 'Drink water' }));
    expect(text('pending')).toBe('1');

    await wait(EDIT_DEBOUNCE_MS - 100);
    expect(account.snapshot().habits).toEqual([]); // not yet: edits are gathered first

    await wait(200);
    expect(account.snapshot().habits.map((h) => h.title)).toEqual(['Drink water']);
    expect(text('pending')).toBe('0');
  });

  it('V2E-31 · edits in quick succession go up together, in one upload', async () => {
    const account = fakeAccount();
    const remote = account.remote();
    const push = vi.spyOn(remote, 'push');
    await openApp(remote);
    push.mockClear();

    act(() => api.dispatch({ type: 'ADD_HABIT', title: 'One' }));
    await wait(500);
    act(() => api.dispatch({ type: 'ADD_HABIT', title: 'Two' }));
    await wait(500);
    act(() => api.dispatch({ type: 'ADD_HABIT', title: 'Three' }));
    await wait(EDIT_DEBOUNCE_MS + 100);

    expect(push).toHaveBeenCalledTimes(1);
    expect(account.snapshot().habits).toHaveLength(3);
  });

  it('V2E-32 · ⭐ a change made on another device appears within 30 seconds, with no reload', async () => {
    const account = fakeAccount();
    await openApp(account.remote());

    await otherDeviceAdds(account, 'From my phone');
    await wait(POLL_MS - 1_000);
    expect(text('habits')).toBe('');

    await wait(1_100);
    expect(text('habits')).toBe('From my phone');
  });

  it('V2E-33 · no checking while the app is hidden; coming back into view checks straight away', async () => {
    const account = fakeAccount();
    const remote = account.remote();
    const pull = vi.spyOn(remote, 'pullSince');
    await openApp(remote);
    pull.mockClear();

    setVisible(false);
    await otherDeviceAdds(account, 'While hidden');
    await wait(POLL_MS * 3);
    expect(pull).not.toHaveBeenCalled();

    setVisible(true);
    await wait(0);
    expect(pull).toHaveBeenCalledTimes(1);
    expect(text('habits')).toBe('While hidden');
  });

  it('V2E-34 · ⭐ offline: edits wait with a count and an error, then go up once the account is back', async () => {
    const account = fakeAccount();
    await openApp(account.remote());

    account.setOffline(true);
    act(() => api.dispatch({ type: 'ADD_HABIT', title: 'Made offline' }));
    await wait(EDIT_DEBOUNCE_MS + 100);

    expect(text('status')).toBe('error');
    expect(text('pending')).toBe('1');
    expect(text('habits')).toBe('Made offline'); // still on the device

    account.setOffline(false);
    await wait(POLL_MS);

    expect(account.snapshot().habits.map((h) => h.title)).toEqual(['Made offline']);
    expect(text('pending')).toBe('0');
    expect(text('status')).toBe('synced');
  });

  it('V2E-35 · ⭐ an edit made while an upload is on its way is not lost: it goes up right after', async () => {
    const account = fakeAccount();
    const inner = account.remote();
    let releaseUpload: (() => void) | null = null;
    const slow: RemoteStore = {
      pullSince: (since) => inner.pullSince(since),
      async push(changes) {
        if (changes.habits.some((h) => h.title === 'Meditate 5 min')) {
          await new Promise<void>((resolve) => (releaseUpload = resolve));
        }
        return inner.push(changes);
      },
    };
    await openApp(slow);
    act(() => api.dispatch({ type: 'ADD_HABIT', title: 'Meditate' }));
    await wait(EDIT_DEBOUNCE_MS + 100);
    const id = account.snapshot().habits[0].id;

    act(() => api.dispatch({ type: 'RENAME_HABIT', id, title: 'Meditate 5 min' }));
    await wait(EDIT_DEBOUNCE_MS + 100); // this upload is now stuck on its way

    // A second rename, and its upload timer fires while the first upload is still stuck.
    act(() => api.dispatch({ type: 'RENAME_HABIT', id, title: 'Meditate 10 min' }));
    await wait(EDIT_DEBOUNCE_MS + 100);

    await act(async () => releaseUpload?.());
    await wait(100);

    expect(account.snapshot().habits.map((h) => h.title)).toEqual(['Meditate 10 min']);
    expect(text('pending')).toBe('0');
  });
});
