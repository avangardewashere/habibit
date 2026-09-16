import type { Metadata } from 'next';
import { Suspense } from 'react';
import { ConfirmSignIn } from '@/components/account/ConfirmSignIn';
import { AppShell } from '@/components/layout/AppShell';

export const metadata: Metadata = {
  title: 'Signing in — Habibit',
  // A one-time link landing page has no business in search results.
  robots: { index: false },
};

/**
 * Where the link in the sign-in email lands.
 *
 * The page itself is static. The token is read from the URL in the browser, so
 * it is wrapped in Suspense: Next requires that for `useSearchParams` in a
 * prerendered page, and it keeps the shell renderable without the token.
 */
export default function ConfirmPage() {
  return (
    <AppShell>
      <h1 className="mb-6 text-3xl font-extrabold tracking-tight text-ink">
        Habi<span className="text-habibit-500">bit</span>
      </h1>
      <Suspense fallback={<p className="text-ink-soft">Signing you in…</p>}>
        <ConfirmSignIn />
      </Suspense>
    </AppShell>
  );
}
