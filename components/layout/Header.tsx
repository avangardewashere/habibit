import { AccountMenu } from '@/components/account/AccountMenu';
import { TodayLabel } from './TodayLabel';

/**
 * Today's header: the wordmark, the date, and the account button.
 *
 * Since v5 Block B the theme and the review have their own places — the theme
 * in Settings, the review as the Progress tab — so the only button left is the
 * account. It stays here rather than moving to Settings because a face in the
 * top corner is where people look for it, and it carries the sync dot, which
 * belongs on the screen you use most. (Its panel is in Settings too.)
 */
export function Header() {
  return (
    <header className="mb-8">
      <div className="flex items-center justify-between gap-3">
        {/*
          * The screen's heading. `screen-heading` is where focus goes when you
          * switch to this tab, as each tab's heading is (components/layout/Screens).
          * The wordmark stays brand coral in both themes — it is identity, not a role.
          */}
        <h1 id="screen-heading" tabIndex={-1} className="min-w-0 text-3xl font-extrabold tracking-tight text-ink outline-none">
          Habi<span className="text-habibit-500">bit</span>
        </h1>
        {/* `relative` anchors the account popup to this group's right edge. */}
        <div className="relative flex shrink-0 items-center gap-2">
          <AccountMenu />
        </div>
      </div>
      <p className="mt-1 text-sm text-ink-soft">Little habits. Lots of love.</p>
      <TodayLabel />
    </header>
  );
}
