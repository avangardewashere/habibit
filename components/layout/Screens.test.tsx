// @vitest-environment jsdom
import { act, render, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { AccountState } from '@/lib/auth/session';
import { HabibitProvider } from '@/store/HabibitProvider';
import { Screens } from './Screens';

/*
 * v5 Block B: the three places, and moving between them.
 *
 * The tabs are plain `#hash` links, so "moving" here is what the browser does
 * on a click: the hash changes and `hashchange` fires. The real click, Back
 * and refresh are walked in a browser by e2e/nav.spec.ts.
 */

let account: AccountState = { status: 'unavailable' };
vi.mock('@/lib/auth/session', () => ({ useAccount: () => account }));

function go(hash: string) {
  act(() => {
    window.location.hash = hash;
    window.dispatchEvent(new HashChangeEvent('hashchange'));
  });
}

function show() {
  render(
    <HabibitProvider>
      <Screens
        today={
          <h1 id="screen-heading" tabIndex={-1}>
            Today screen
          </h1>
        }
      />
    </HabibitProvider>,
  );
}

const nav = () => screen.getByRole('navigation', { name: 'Main' });

beforeEach(() => {
  account = { status: 'unavailable' };
  localStorage.clear();
  window.history.replaceState(null, '', '/');
  window.scrollTo = vi.fn() as unknown as typeof window.scrollTo;
  // jsdom has no matchMedia; the theme rows in Settings read it for "Match device".
  window.matchMedia = ((query: string) => ({
    matches: false,
    media: query,
    addEventListener: () => {},
    removeEventListener: () => {},
  })) as unknown as typeof window.matchMedia;
});
afterEach(() => window.history.replaceState(null, '', '/'));

describe('V5B: the tab bar', () => {
  it('V5B-50 · ⭐ three tabs, in order, each a real link to its place', () => {
    show();
    const links = within(nav()).getAllByRole('link');
    expect(links.map((l) => l.textContent)).toEqual(['Today', 'Progress', 'Settings']);
    expect(links.map((l) => l.getAttribute('href'))).toEqual(['#today', '#progress', '#settings']);
  });

  it('V5B-51 · ⭐ with no hash, Today is showing and marked as the current page', () => {
    show();
    expect(screen.getByRole('heading', { name: 'Today screen' })).toBeInTheDocument();
    expect(within(nav()).getByRole('link', { name: 'Today' })).toHaveAttribute('aria-current', 'page');
    expect(within(nav()).getByRole('link', { name: 'Progress' })).not.toHaveAttribute('aria-current');
  });

  it('V5B-52 · ⭐ a hash change shows that tab, and only that tab', () => {
    show();
    go('#progress');

    expect(screen.getByRole('heading', { level: 1, name: 'Progress' })).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Today screen' })).not.toBeInTheDocument();
    expect(within(nav()).getByRole('link', { name: 'Progress' })).toHaveAttribute('aria-current', 'page');

    go('#settings');
    expect(screen.getByRole('heading', { level: 1, name: 'Settings' })).toBeInTheDocument();
    expect(screen.queryByRole('heading', { level: 1, name: 'Progress' })).not.toBeInTheDocument();
  });

  it('V5B-53 · ⭐ switching moves focus to the new screen’s heading, and to the top', () => {
    // As a new page would: a screen reader hears where it now is.
    show();
    go('#settings');

    expect(screen.getByRole('heading', { level: 1, name: 'Settings' })).toHaveFocus();
    expect(window.scrollTo).toHaveBeenCalledWith(0, 0);
  });

  it('V5B-54 · opening the page does not steal focus or scroll', () => {
    show();
    expect(document.body).toHaveFocus();
    expect(window.scrollTo).not.toHaveBeenCalled();
  });

  it('V5B-55 · going back to Today shows it again', () => {
    show();
    go('#progress');
    go('#today');
    expect(screen.getByRole('heading', { name: 'Today screen' })).toBeInTheDocument();
  });
});

describe('V5B: Settings', () => {
  it('V5B-56 · ⭐ a build with no accounts shows no account section — not a half-working one', () => {
    show();
    go('#settings');
    expect(screen.getByRole('region', { name: 'Appearance' })).toBeInTheDocument();
    expect(screen.getByRole('region', { name: 'About' })).toBeInTheDocument();
    expect(screen.queryByRole('region', { name: 'Account & sync' })).not.toBeInTheDocument();
    expect(screen.getByText(/kept in this browser, on this device, and nowhere else/)).toBeInTheDocument();
  });

  it('V5B-57 · with accounts, the sign-in panel is right there', () => {
    account = { status: 'signed-out' };
    show();
    go('#settings');
    const section = screen.getByRole('region', { name: 'Account & sync' });
    expect(within(section).getByRole('textbox')).toBeInTheDocument();
  });

  it('V5B-58 · ⭐ privacy is one tap away from Settings, signed in or not', () => {
    show();
    go('#settings');
    expect(within(screen.getByRole('region', { name: 'About' })).getByRole('link', { name: 'Privacy' }))
      .toHaveAttribute('href', '/privacy');
  });
});

describe('V5B: Progress with nothing in it', () => {
  it('V5B-59 · says what will fill it, rather than showing empty charts', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    vi.setSystemTime(new Date('2026-10-07T09:00:00+08:00'));
    show();
    go('#progress');
    expect(await screen.findByText('Nothing to show yet')).toBeInTheDocument();
    expect(screen.queryByRole('region', { name: 'Highlights' })).not.toBeInTheDocument();
    vi.useRealTimers();
  });
});
