'use client';

import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import { verifyLink, type AuthResult } from '@/lib/auth/actions';

/*
 * A sign-in link works exactly once. React's StrictMode (and a fast double
 * render) can run this page's effect twice, and a second verify would fail and
 * show "expired" to someone who has in fact just signed in. So each token is
 * verified at most once per page load, and every caller shares that one result.
 */
const attempts = new Map<string, Promise<AuthResult>>();

function verifyOnce(tokenHash: string): Promise<AuthResult> {
  let attempt = attempts.get(tokenHash);
  if (!attempt) {
    attempt = verifyLink(tokenHash);
    attempts.set(tokenHash, attempt);
  }
  return attempt;
}

export function ConfirmSignIn() {
  const params = useSearchParams();
  const router = useRouter();
  const tokenHash = params.get('token_hash');
  const [failure, setFailure] = useState<string | null>(null);

  useEffect(() => {
    if (!tokenHash) return;
    let cancelled = false;
    verifyOnce(tokenHash).then((result) => {
      if (cancelled) return;
      if (result.ok) router.replace('/');
      else setFailure(result.message);
    });
    return () => {
      cancelled = true;
    };
  }, [tokenHash, router]);

  const message = !tokenHash ? 'This sign-in link is incomplete. Ask for a new one from the app.' : failure;

  if (!message) {
    return (
      <p className="text-ink-soft" role="status">
        Signing you in…
      </p>
    );
  }

  return (
    <div className="space-y-4 rounded-card border border-line bg-card p-5">
      <h2 className="font-extrabold text-ink">Couldn’t sign you in</h2>
      <p role="alert" className="text-sm text-ink">
        {message}
      </p>
      <Link
        href="/"
        className="inline-grid min-h-11 place-items-center rounded-full bg-accent px-5 text-sm font-extrabold text-on-accent focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
      >
        Back to Habibit
      </Link>
    </div>
  );
}
