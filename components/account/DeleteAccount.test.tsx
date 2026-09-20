// @vitest-environment jsdom
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

/*
 * v3 Block F: the way out, in the account popup.
 *
 * Most of these tests are about **wording**, which is unusual and deliberate.
 * Everything else in the app can be undone by doing it again; this cannot. The
 * only protection anyone has is that the screen told them the truth before they
 * tapped — including the part that is easy to leave out, which is what *doesn't*
 * go.
 */

const sync = vi.hoisted(() => ({
  deleteResult: null as string | null,
  deleteCalls: 0,
  signOutCalls: 0,
}));

vi.mock('@/store/SyncProvider', () => ({
  useSync: () => ({
    status: { state: 'synced', at: new Date() },
    pending: 0,
    syncNow: async () => true,
    signOutAndClear: async () => {
      sync.signOutCalls += 1;
      return true;
    },
    deleteAccountKeepingDevice: async () => {
      sync.deleteCalls += 1;
      return sync.deleteResult;
    },
  }),
}));

// Reminders are a section of the same popup; not what these tests are about.
vi.mock('./ReminderSettings', () => ({ ReminderSettings: () => null }));

import { AccountPanel } from './AccountPanel';

const signedIn = { status: 'signed-in', email: 'me@example.com' } as const;

const deleteButton = () => screen.getByRole('button', { name: 'Delete account' });
const confirmButton = () => screen.getByRole('button', { name: 'Delete my account' });

function openDeleteStep() {
  render(<AccountPanel account={signedIn} />);
  fireEvent.click(deleteButton());
}

beforeEach(() => {
  sync.deleteResult = null;
  sync.deleteCalls = 0;
  sync.signOutCalls = 0;
});

describe('V3F: leaving', () => {
  it('V3F-10 · ⭐ one tap never deletes anything', async () => {
    render(<AccountPanel account={signedIn} />);

    fireEvent.click(deleteButton());

    expect(sync.deleteCalls).toBe(0);
    expect(confirmButton()).toBeInTheDocument();
  });

  it('V3F-11 · ⭐ says what goes, and that it cannot be undone', () => {
    openDeleteStep();

    const said = document.body.textContent ?? '';
    expect(said).toMatch(/removes it and everything synced to it/);
    expect(said).toMatch(/habits/);
    expect(said).toMatch(/reminders/);
    expect(said).toMatch(/every device signed in to it/);
    expect(said).toMatch(/can’t be undone/);
  });

  it('V3F-12 · ⭐ says what stays, which is the part people are afraid of', () => {
    // Without this sentence the honest reading of "deletes everything" is that
    // the habits on this phone go too. They don't.
    openDeleteStep();

    expect(screen.getByText(/Your habits stay on this device/)).toBeInTheDocument();
    expect(document.body.textContent).toMatch(/keeps working, signed out/);
  });

  it('V3F-13 · ⭐ backing out deletes nothing and puts everything back', () => {
    openDeleteStep();

    fireEvent.click(screen.getByRole('button', { name: 'Keep my account' }));

    expect(sync.deleteCalls).toBe(0);
    expect(screen.getByRole('button', { name: 'Sign out' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Delete my account' })).not.toBeInTheDocument();
  });

  it('V3F-14 · ⭐ confirming deletes, and does not sign out and wipe the device instead', () => {
    // These two buttons sit next to each other and do nearly opposite things:
    // one empties the account and keeps the device, the other the reverse.
    openDeleteStep();

    fireEvent.click(confirmButton());

    expect(sync.deleteCalls).toBe(1);
    expect(sync.signOutCalls).toBe(0);
  });

  it('V3F-15 · ⭐ a delete that failed says so, and leaves the account alone', async () => {
    sync.deleteResult = 'Couldn’t reach the server. Check your connection and try again.';
    openDeleteStep();

    fireEvent.click(confirmButton());

    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent(/Couldn’t reach the server/));
    // Still on the confirm step, so it can be tried again without hunting for it.
    expect(confirmButton()).toBeInTheDocument();
  });

  it('V3F-16 · the button is busy while it works, so it cannot be tapped twice', async () => {
    openDeleteStep();

    fireEvent.click(confirmButton());

    await waitFor(() => expect(screen.getByRole('button', { name: 'Deleting…' })).toBeDisabled());
  });

  it('V3F-17 · ⭐ signed out, there is nothing to delete', () => {
    render(<AccountPanel account={{ status: 'signed-out' }} />);

    expect(screen.queryByRole('button', { name: 'Delete account' })).not.toBeInTheDocument();
  });

  it('V3F-18 · the way out is quieter than the way in', () => {
    // Delete is a plain link-ish control, not a second big button competing
    // with "Sign out". It should be findable, not offered.
    render(<AccountPanel account={signedIn} />);

    expect(deleteButton().className).not.toContain('bg-accent');
    expect(screen.getByRole('button', { name: 'Sign out' }).className).toContain('bg-accent');
  });
});
