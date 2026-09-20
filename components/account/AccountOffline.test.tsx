// @vitest-environment jsdom
import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { SyncStatus } from '@/store/SyncProvider';

/*
 * v2 Block F: what the account button and its popup say while there's no
 * connection. Offline is expected and fixes itself, so it must not look like a
 * fault — that's the difference these tests hold in place.
 */

type Failure = Extract<SyncStatus, { state: 'error' }>;
const OFFLINE: Failure = { state: 'error', message: 'You’re offline. Your habits are safe on this device.', offline: true };
const UNREACHABLE: Failure = { state: 'error', message: 'Couldn’t reach your account.', offline: false };

const sync = vi.hoisted(() => ({ status: { state: 'off' } as SyncStatus, pending: 0 }));
vi.mock('@/store/SyncProvider', () => ({
  useSync: () => ({
    ...sync,
    syncNow: async () => false,
    signOutAndClear: async () => false,
    deleteAccountKeepingDevice: async () => 'Accounts are not available right now.',
  }),
}));
vi.mock('@/lib/auth/session', () => ({ useAccount: () => ({ status: 'signed-in', email: 'me@example.com' }) }));
/*
 * The panel reads the reminder setting when it opens (v3 Block D), so the
 * stand-in client has to answer `from` as well. Returning "no row" is the
 * honest answer for a device that has never turned reminders on.
 */
vi.mock('@/lib/supabase/client', () => ({
  getSupabase: () => ({
    from: () => ({
      select: () => ({ maybeSingle: async () => ({ data: null, error: null }) }),
      upsert: async () => ({ error: null }),
      delete: () => ({ eq: async () => ({ error: null }) }),
    }),
  }),
}));

import { AccountMenu } from './AccountMenu';
import { AccountPanel } from './AccountPanel';

const dot = () => document.querySelector('[data-sync-dot]');

beforeEach(() => {
  sync.status = { state: 'off' };
  sync.pending = 0;
});

describe('V2F: the account button while offline', () => {
  it('V2F-20 · ⭐ offline gets the quiet dot and says so, rather than reporting a problem', () => {
    sync.status = OFFLINE;
    sync.pending = 1;
    render(<AccountMenu />);

    expect(dot()).toHaveAttribute('data-sync-dot', 'offline');
    expect(dot()?.className).toContain('bg-ink-soft');
    const name = screen.getByRole('button').getAttribute('aria-label') ?? '';
    expect(name).toContain('. Offline');
    expect(name).toContain('1 change waiting to sync');
    expect(name).not.toContain('Sync problem');
  });

  it('V2F-21 · a failure with a working connection still reports a problem', () => {
    sync.status = UNREACHABLE;
    sync.pending = 1;
    render(<AccountMenu />);

    expect(dot()).toHaveAttribute('data-sync-dot', 'problem');
    expect(dot()?.className).toContain('bg-danger');
    expect(screen.getByRole('button').getAttribute('aria-label')).toContain('. Sync problem');
  });

  it('V2F-22 · ⭐ the popup tells you you’re offline as news, not as an error', () => {
    sync.status = OFFLINE;
    render(<AccountPanel account={{ status: 'signed-in', email: 'me@example.com' }} />);

    expect(screen.getByText(OFFLINE.message)).toHaveAttribute('role', 'status');
    expect(screen.queryByRole('alert')).toBeNull();
  });
});
