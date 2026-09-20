'use client';

import { useState } from 'react';
import type { FormEvent } from 'react';
import { looksLikeEmail, requestSignIn, verifyCode } from '@/lib/auth/actions';
import type { AccountState } from '@/lib/auth/session';
import { useSync, type SyncStatus } from '@/store/SyncProvider';
import { ReminderSettings } from './ReminderSettings';

const button =
  'min-h-11 w-full touch-manipulation rounded-full bg-accent px-4 text-sm font-extrabold text-on-accent transition active:scale-[0.98] disabled:bg-line disabled:text-ink-soft focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent';
const quietButton =
  'min-h-11 touch-manipulation rounded-full px-3 text-sm font-bold text-ink-soft underline-offset-2 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent';
/* text-base is 16px: below that, iOS Safari zooms on focus. */
const input =
  'min-h-11 w-full rounded-lg border border-line bg-surface px-3 text-base text-ink outline-none placeholder:text-ink-soft focus:border-accent';

/** What's inside the account popup, for each account state. */
export function AccountPanel({ account }: { account: AccountState }) {
  if (account.status === 'signed-in') return <SignedIn email={account.email} />;
  if (account.status === 'signed-out') return <SignIn />;
  return <p className="text-sm text-ink-soft">Checking your account…</p>;
}

function SignedIn({ email }: { email: string }) {
  const { status, pending, syncNow, signOutAndClear } = useSync();
  // Signing out empties the device, so it takes a confirming second tap, like deleting.
  const [step, setStep] = useState<'idle' | 'confirm' | 'unsynced'>('idle');
  const [busy, setBusy] = useState(false);

  async function onSignOut(force: boolean) {
    setBusy(true);
    const done = await signOutAndClear({ force });
    setBusy(false);
    // Not done without force means the account couldn't be reached: say so before losing anything.
    if (!done && !force) setStep('unsynced');
  }

  return (
    <div className="space-y-3">
      <div>
        <p className="text-xs font-bold uppercase tracking-wide text-ink-soft">Signed in as</p>
        <p className="break-all font-bold text-ink">{email}</p>
      </div>

      <SyncLine status={status} pending={pending} onRetry={() => void syncNow()} />

      {step === 'idle' && <ReminderSettings />}

      {step === 'idle' && (
        <button type="button" onClick={() => setStep('confirm')} className={button}>
          Sign out
        </button>
      )}

      {step === 'confirm' && (
        <div className="space-y-3">
          <p className="text-sm text-ink">
            Signing out removes your habits from this device. They stay safe in your account.
          </p>
          <button type="button" onClick={() => onSignOut(false)} disabled={busy} className={button}>
            {busy ? 'Signing out…' : 'Sign out and clear this device'}
          </button>
          <button type="button" onClick={() => setStep('idle')} disabled={busy} className={quietButton}>
            Cancel
          </button>
        </div>
      )}

      {step === 'unsynced' && (
        <div className="space-y-3">
          <ErrorText>
            Couldn’t reach your account, so recent changes on this device may not be saved there yet. Signing
            out now would lose them.
          </ErrorText>
          <button type="button" onClick={() => onSignOut(true)} disabled={busy} className={button}>
            {busy ? 'Signing out…' : 'Sign out anyway'}
          </button>
          <button type="button" onClick={() => setStep('idle')} disabled={busy} className={quietButton}>
            Stay signed in
          </button>
        </div>
      )}
    </div>
  );
}

function SyncLine({ status, pending, onRetry }: { status: SyncStatus; pending: number; onRetry: () => void }) {
  const waiting = pending > 0 ? `${pending} change${pending === 1 ? '' : 's'} waiting to sync.` : null;

  if (status.state === 'error') {
    return (
      <div className="space-y-1">
        {/* Offline is an ordinary state of the world, so it is told plainly rather than raised as an error. */}
        {status.offline ? (
          <p className="text-sm text-ink" role="status">
            {status.message}
          </p>
        ) : (
          <ErrorText>{status.message}</ErrorText>
        )}
        {waiting && (
          <p className="text-sm text-ink-soft" role="status">
            {waiting}
          </p>
        )}
        <button type="button" onClick={onRetry} className={quietButton}>
          Try again
        </button>
      </div>
    );
  }
  const text =
    status.state === 'syncing'
      ? 'Syncing…'
      : waiting
        ? waiting
        : status.state === 'synced'
          ? 'Synced. Your habits are saved to your account.'
          : 'Your habits sync automatically while you’re signed in.';
  return (
    <p className="text-sm text-ink-soft" role="status">
      {text}
    </p>
  );
}

function SignIn() {
  const [step, setStep] = useState<'email' | 'code'>('email');
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  async function run(action: () => Promise<{ ok: true } | { ok: false; message: string }>) {
    setBusy(true);
    setError(null);
    setNotice(null);
    const result = await action();
    setBusy(false);
    if (!result.ok) setError(result.message);
    return result.ok;
  }

  async function onSendCode(event: FormEvent) {
    event.preventDefault();
    if (!looksLikeEmail(email)) return;
    if (await run(() => requestSignIn(email))) setStep('code');
  }

  async function onVerify(event: FormEvent) {
    event.preventDefault();
    // On success the whole panel switches to "signed in" by itself, via the session store.
    await run(() => verifyCode(email, code));
  }

  async function onResend() {
    if (await run(() => requestSignIn(email))) {
      setCode('');
      setNotice('A new code is on its way.');
    }
  }

  if (step === 'code') {
    const digits = code.replace(/\D/g, '');
    return (
      <form onSubmit={onVerify} className="space-y-3">
        <div>
          <h2 className="font-extrabold text-ink">Check your email</h2>
          <p className="text-sm text-ink-soft">
            We sent a code to <strong className="break-all text-ink">{email.trim()}</strong>. Type it
            here, or tap the link in the email.
          </p>
        </div>
        <input
          value={code}
          onChange={(event) => setCode(event.target.value)}
          aria-label="Sign-in code"
          placeholder="Enter code"
          inputMode="numeric"
          autoComplete="one-time-code"
          enterKeyHint="go"
          maxLength={12}
          autoFocus
          className={`${input} text-center text-lg font-extrabold tracking-[0.3em] placeholder:text-base placeholder:font-normal placeholder:tracking-normal`}
        />
        {error && <ErrorText>{error}</ErrorText>}
        {notice && <p className="text-sm text-ink-soft" role="status">{notice}</p>}
        <button type="submit" disabled={busy || digits.length < 6} className={button}>
          {busy ? 'Checking…' : 'Sign in'}
        </button>
        <div className="flex flex-wrap justify-between">
          <button
            type="button"
            className={quietButton}
            onClick={() => {
              setStep('email');
              setCode('');
              setError(null);
              setNotice(null);
            }}
          >
            Use a different email
          </button>
          <button type="button" className={quietButton} onClick={onResend} disabled={busy}>
            Send a new code
          </button>
        </div>
      </form>
    );
  }

  return (
    <form onSubmit={onSendCode} className="space-y-3" noValidate>
      <div>
        <h2 className="font-extrabold text-ink">Sync across devices</h2>
        <p className="text-sm text-ink-soft">
          Sign in with your email. No password: we’ll send you a code. Your habits stay on this
          device either way.
        </p>
      </div>
      <input
        type="email"
        value={email}
        onChange={(event) => setEmail(event.target.value)}
        aria-label="Email address"
        placeholder="you@example.com"
        inputMode="email"
        autoComplete="email"
        enterKeyHint="send"
        autoFocus
        className={input}
      />
      {error && <ErrorText>{error}</ErrorText>}
      <button type="submit" disabled={busy || !looksLikeEmail(email)} className={button}>
        {busy ? 'Sending…' : 'Email me a code'}
      </button>
    </form>
  );
}

function ErrorText({ children }: { children: string }) {
  return (
    // Not text-danger: that red is only ~2.6:1 on the dark card. Readable ink plus a
    // coral bar, both already contrast-tested in lib/contrast.test.ts.
    <p role="alert" className="border-l-4 border-accent pl-3 text-sm font-bold text-ink">
      {children}
    </p>
  );
}
