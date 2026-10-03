import { ChartNoAxesColumn, ListChecks, Settings, type LucideIcon } from 'lucide-react';
import { hrefForTab, type Tab } from '@/lib/tab';

const ITEMS: { tab: Tab; label: string; Icon: LucideIcon }[] = [
  { tab: 'today', label: 'Today', Icon: ListChecks },
  { tab: 'progress', label: 'Progress', Icon: ChartNoAxesColumn },
  { tab: 'settings', label: 'Settings', Icon: Settings },
];

/**
 * The bar along the bottom: the three places in the app (v5 Block B).
 *
 * **Plain links.** Each one is `<a href="#progress">`, so the browser puts the
 * tab in history and Back takes you to the previous one, with nothing here
 * imitating that. `aria-current="page"` is what a screen reader announces as
 * "current page", the same as on any website's navigation.
 *
 * The chosen tab is shown three ways — a filled pill behind the icon, a darker
 * label, and the announcement — so it never rests on colour alone. The pill
 * uses the progress badge's pair, already tested at 4.5:1 in both themes.
 *
 * At the bottom because that is where a thumb is. Fixed, with the home
 * indicator's inset added underneath, so it sits above it once installed.
 */
export function BottomNav({ current }: { current: Tab }) {
  return (
    <nav
      aria-label="Main"
      className="fixed inset-x-0 bottom-0 z-30 border-t border-line bg-card pb-[env(safe-area-inset-bottom)] pl-[env(safe-area-inset-left)] pr-[env(safe-area-inset-right)]"
    >
      <ul className="mx-auto flex w-full max-w-md">
        {ITEMS.map(({ tab, label, Icon }) => {
          const active = tab === current;
          return (
            <li key={tab} className="flex-1">
              <a
                href={hrefForTab(tab)}
                aria-current={active ? 'page' : undefined}
                className="flex min-h-16 touch-manipulation flex-col items-center justify-center gap-1 text-[11px] font-extrabold tracking-wide transition active:scale-95 focus-visible:outline-2 focus-visible:outline-offset-[-4px] focus-visible:outline-accent"
              >
                <span
                  aria-hidden
                  className={[
                    'grid h-8 w-16 place-items-center rounded-full transition-colors duration-200',
                    active ? 'bg-badge-bg text-badge-fg' : 'text-ink-soft',
                  ].join(' ')}
                >
                  <Icon className="h-5 w-5" strokeWidth={active ? 2.75 : 2.25} />
                </span>
                <span className={active ? 'text-ink' : 'text-ink-soft'}>{label}</span>
              </a>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
