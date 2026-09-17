'use client';

import { useState } from 'react';
import type { FormEvent } from 'react';
import { looksLikeEmail, requestSignIn, signOut, verifyCode } from '@/lib/auth/actions';
import type { AccountState } from '@/lib/auth/session';

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
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSignOut() {
    setBusy(true);
    const result = await signOut();
    setBusy(false);
    if (!result.ok) setError(result.message);
  }

  return (
    <div className="space-y-3">
      <div>
        <p className="text-xs font-bold uppercase tracking-wide text-ink-soft">Signed in as</p>
        <p className="break-all font-bold text-ink">{email}</p>
      </div>
      <p className="text-sm text-ink-soft">
        Syncing between devices arrives in the next update. Your habits are still saved on this device.
      </p>
      {error && <ErrorText>{error}</ErrorText>}
      <button type="button" onClick={onSignOut} disabled={busy} className={button}>
        {busy ? 'Signing out…' : 'Sign out'}
      </button>
    </div>
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
