'use client';

import { CircleUserRound, UserRound } from 'lucide-react';
import { useId } from 'react';
import { usePopover } from '@/components/ui/usePopover';
import { useAccount } from '@/lib/auth/session';
import { useSync } from '@/store/SyncProvider';
import { AccountPanel } from './AccountPanel';

/**
 * The header's account button and the popup it opens.
 *
 * Renders nothing at all when this build has no Supabase settings, so the app
 * without accounts looks exactly like v1.
 */
export function AccountMenu() {
  const account = useAccount();
  const { open, toggle, anchorRef, wrapperRef } = usePopover<HTMLButtonElement, HTMLDivElement>();
  const panelId = useId();
  const { status, pending } = useSync();

  if (account.status === 'unavailable') return null;

  const signedIn = account.status === 'signed-in';
  const Icon = signedIn ? CircleUserRound : UserRound;

  // Your choice: nothing when all is synced; a quiet dot while edits wait to go up;
  // a warning dot while syncing is failing. The same news goes in the label for screen readers.
  //
  // Being offline is not a fault — nothing is lost and it fixes itself — so it
  // gets the quiet dot, not the warning one.
  const failure = signedIn && status.state === 'error' ? status : null;
  const offline = failure?.offline === true;
  const problem = failure !== null && !offline;
  const waiting = failure === null && signedIn && pending > 0;
  const count = `${pending} change${pending === 1 ? '' : 's'} waiting to sync`;
  const syncNote = problem
    ? '. Sync problem'
    : offline
      ? `. Offline${pending > 0 ? `. ${count}` : ''}`
      : waiting
        ? `. ${count}`
        : '';

  return (
    /*
     * Not `relative`: the popup is positioned against the whole header actions
     * group (see Header), so it lines up with the right edge of the screen
     * content rather than with this button, which has the theme toggle beside it.
     */
    <div ref={wrapperRef}>
      <button
        ref={anchorRef}
        type="button"
        onClick={toggle}
        aria-label={signedIn ? `Account: signed in as ${account.email}${syncNote}` : 'Account: sign in to sync'}
        aria-expanded={open}
        aria-controls={panelId}
        className={[
          'relative grid h-11 w-11 touch-manipulation place-items-center rounded-full border transition active:scale-90',
          'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent',
          signedIn ? 'border-accent bg-accent text-on-accent' : 'border-line bg-card text-ink-soft',
        ].join(' ')}
      >
        <Icon className="h-5 w-5" strokeWidth={2.5} />
        {(waiting || offline || problem) && (
          <span
            aria-hidden
            data-sync-dot={problem ? 'problem' : offline ? 'offline' : 'waiting'}
            className={[
              // A ring in the page colour separates the dot from the coral button in both themes.
              'absolute -right-0.5 -top-0.5 h-3 w-3 rounded-full ring-2 ring-surface',
              problem ? 'bg-danger' : 'bg-ink-soft',
            ].join(' ')}
          />
        )}
      </button>

      {open && (
        <div
          id={panelId}
          role="dialog"
          aria-label="Account"
          className="absolute right-0 top-full z-20 mt-2 w-[min(20rem,calc(100vw-2.5rem))] rounded-card border border-line bg-card p-4 text-left shadow-lg"
        >
          <AccountPanel account={account} />
        </div>
      )}
    </div>
  );
}
