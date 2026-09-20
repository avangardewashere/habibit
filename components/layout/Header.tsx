import { AccountMenu } from '@/components/account/AccountMenu';
import { ReviewButton } from '@/components/habit/ReviewButton';
import { ThemeMenu } from '@/components/theme/ThemeMenu';
import { TodayLabel } from './TodayLabel';

export function Header() {
  return (
    <header className="mb-8">
      {/*
        Only the wordmark shares a row with the buttons. The tagline sits below at
        full width: with the account button added, keeping it in the same column
        squeezed it onto two lines on a 375px phone.
      */}
      <div className="flex items-center justify-between gap-3">
        <h1 className="min-w-0 text-3xl font-extrabold tracking-tight text-ink">
          {/* The wordmark stays brand coral in both themes — it is identity, not a role. */}
          Habi<span className="text-habibit-500">bit</span>
        </h1>
        {/* `relative` anchors both popups to this group's right edge. */}
        <div className="relative flex shrink-0 items-center gap-2">
          <ReviewButton />
          <AccountMenu />
          <ThemeMenu />
        </div>
      </div>
      <p className="mt-1 text-sm text-ink-soft">Little habits. Lots of love.</p>
      <TodayLabel />
    </header>
  );
}
