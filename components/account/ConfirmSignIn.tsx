'use client';

import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import { signInFromLinkFragment, verifyLink, type AuthResult } from '@/lib/auth/actions';

const INCOMPLETE: AuthResult = {
  ok: false,
  message: 'This sign-in link is incomplete. Ask for a new one from the app.',
};

/*
 * A sign-in link works exactly once. React's StrictMode (and a fast double
 * render) can run this page's effect twice, and a second attempt would fail and
 * show "expired" to someone who has in fact just signed in. So each link is used
 * at most once per page load, and every caller shares that one result.
 */
const attempts = new Map<string, Promise<AuthResult>>();

function once(key: string, attempt: () => Promise<AuthResult>): Promise<AuthResult> {
  let result = attempts.get(key);
  if (!result) {
    result = attempt();
    attempts.set(key, result);
  }
  return result;
}

/**
 * Two kinds of link land here:
 * - Habibit's own email: `?token_hash=…`
 * - Supabase's default email: `#access_token=…` or `#error_code=…`
 *   (the hash is never sent to a server, so it can only be read in the browser)
 */
function signInFromThisUrl(tokenHash: string | null): Promise<AuthResult> {
  if (tokenHash) return once(`hash:${tokenHash}`, () => verifyLink(tokenHash));

  const fragment = window.location.hash;
  if (fragment.length > 1) return once(`fragment:${fragment}`, () => signInFromLinkFragment(fragment));

  return Promise.resolve(INCOMPLETE);
}

export function ConfirmSignIn() {
  const params = useSearchParams();
  const router = useRouter();
  const tokenHash = params.get('token_hash');
  const [failure, setFailure] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    signInFromThisUrl(tokenHash).then((result) => {
      if (cancelled) return;
      // Replacing the URL also clears the tokens out of the address bar and history.
      if (result.ok) router.replace('/');
      else setFailure(result.message);
    });
    return () => {
      cancelled = true;
    };
  }, [tokenHash, router]);

  if (!failure) {
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
        {failure}
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
