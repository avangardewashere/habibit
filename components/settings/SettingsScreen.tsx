'use client';

import { ChevronRight } from 'lucide-react';
import Link from 'next/link';
import type { ReactNode } from 'react';
import { AccountPanel } from '@/components/account/AccountPanel';
import { useAccount } from '@/lib/auth/session';
import { ThemeSetting } from './ThemeSetting';

/** Shown in About. Bumped with each version's last block. */
export const APP_VERSION = '5';

/**
 * The Settings tab (v5 Block B): everything about the app rather than about
 * your habits, gathered in one place instead of behind header icons.
 *
 * - **Appearance** — the theme, as three rows instead of a popup.
 * - **Account & sync** — the same panel the header's account button opens:
 *   sign in, what's syncing, the daily reminder, sign out, delete. Absent in a
 *   build with no accounts, exactly as the button is, so a fork without
 *   Supabase settings shows no half-working section.
 * - **About** — what Habibit keeps and where, the version, and the privacy page.
 *   That link used to sit alone at the foot of the list; it is reachable from
 *   every screen here, signed in or not, which is the reason it existed.
 */
export function SettingsScreen() {
  const account = useAccount();

  return (
    <div>
      <header className="mb-6">
        <h1 id="screen-heading" tabIndex={-1} className="text-3xl font-extrabold tracking-tight text-ink outline-none">
          Settings
        </h1>
        <p className="mt-1 text-sm text-ink-soft">How Habibit looks, and where your habits live.</p>
      </header>

      <div className="space-y-6">
        <Group title="Appearance">
          <ThemeSetting />
        </Group>

        {account.status !== 'unavailable' && (
          <Group title="Account & sync">
            <div className="p-4">
              <AccountPanel account={account} />
            </div>
          </Group>
        )}

        <Group title="About">
          <div className="space-y-1 px-4 py-3 text-sm text-ink-soft">
            <p className="font-bold text-ink">
              Habi<span className="text-habibit-500">bit</span> · version {APP_VERSION}
            </p>
            <p>
              {account.status === 'unavailable'
                ? 'Your habits are kept in this browser, on this device, and nowhere else.'
                : 'Your habits are kept on this device. Sign in and they sync to your account too.'}
            </p>
          </div>
          <Link
            href="/privacy"
            className="flex min-h-12 items-center gap-3 border-t border-line px-4 text-[15px] font-semibold text-ink transition active:bg-surface focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-accent"
          >
            <span className="min-w-0 flex-1">Privacy</span>
            <ChevronRight aria-hidden className="h-5 w-5 text-ink-soft" strokeWidth={2.25} />
          </Link>
        </Group>
      </div>
    </div>
  );
}

/** A titled card, the way settings are grouped on every phone. */
function Group({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section aria-label={title}>
      <h2 className="mb-2 px-1 text-xs font-bold uppercase tracking-wide text-ink-soft">{title}</h2>
      <div className="overflow-hidden rounded-card border border-line bg-card">{children}</div>
    </section>
  );
}
