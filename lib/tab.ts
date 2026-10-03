/**
 * The three places in the app (v5 Block B).
 *
 * They are views of the one page, not three pages: the service worker caches
 * the single page this app has, and an uncached navigation with no signal falls
 * back to it — so a real `/progress` opened offline would quietly show Today.
 * The tab lives in the address's hash instead (`#progress`), which the browser
 * keeps in history, survives a refresh, and never asks the server about.
 *
 * Pure, so the rules can be tested without a browser; `useTab` is the part that
 * listens.
 */
export const TABS = ['today', 'progress', 'settings'] as const;
export type Tab = (typeof TABS)[number];

/**
 * The tab a hash names, or Today for anything else — an empty hash, an old
 * bookmark, a typo. Lenient on purpose: an address can never leave someone on
 * a blank screen.
 */
export function tabFromHash(hash: string): Tab {
  const name = hash.replace(/^#/, '').toLowerCase();
  return (TABS as readonly string[]).includes(name) ? (name as Tab) : 'today';
}

/** The link to a tab. */
export function hrefForTab(tab: Tab): string {
  return `#${tab}`;
}
