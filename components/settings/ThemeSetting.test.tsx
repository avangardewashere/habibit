// @vitest-environment jsdom
import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { THEME_COLOURS, THEME_KEY } from '@/lib/theme';

/*
 * The theme, as three rows in Settings (v5 Block B).
 *
 * Until v5 this was a header button with a popup (v3 Block A, V3A-05..08). The
 * popup is gone — Settings has room for all three choices at once — so the
 * tests about opening, closing and returning focus to a button went with it.
 * What they protected still stands and is checked here: the current theme is
 * shown, picking one applies and stores it, and the component only draws.
 */

/* As in ThemeEffect.test.tsx: a fresh copy of the cached preference per test, like a page load. */
async function loadThemeSetting() {
  vi.resetModules();
  return (await import('./ThemeSetting')).ThemeSetting;
}

function metas() {
  return [...document.head.querySelectorAll('meta[name="theme-color"]')].map((el) => ({
    content: el.getAttribute('content'),
    media: el.getAttribute('media'),
  }));
}

beforeEach(() => {
  window.matchMedia = ((query: string) => ({
    matches: false,
    media: query,
    addEventListener: () => {},
    removeEventListener: () => {},
  })) as unknown as typeof window.matchMedia;
  localStorage.clear();
  document.head.innerHTML = `
    <meta name="theme-color" content="${THEME_COLOURS.light}" media="(prefers-color-scheme: light)">
    <meta name="theme-color" content="${THEME_COLOURS.dark}" media="(prefers-color-scheme: dark)">`;
  delete document.documentElement.dataset.theme;
});

describe('the theme setting', () => {
  it('V5B-30 · ⭐ all three themes are on screen, with the one in use chosen', async () => {
    localStorage.setItem(THEME_KEY, 'dark');
    const ThemeSetting = await loadThemeSetting();
    render(<ThemeSetting />);

    expect(screen.getByRole('radiogroup', { name: 'Colour theme' })).toBeInTheDocument();
    expect(screen.getAllByRole('radio').map((r) => r.getAttribute('aria-label'))).toEqual([
      'Light theme',
      'Dark theme',
      'Match device theme',
    ]);
    expect(screen.getByRole('radio', { name: 'Dark theme' })).toBeChecked();
    expect(screen.getByRole('radio', { name: 'Light theme' })).not.toBeChecked();
  });

  it('V5B-31 · with nothing chosen, it matches the device', async () => {
    const ThemeSetting = await loadThemeSetting();
    render(<ThemeSetting />);
    expect(screen.getByRole('radio', { name: 'Match device theme' })).toBeChecked();
  });

  it('V5B-32 · ⭐ picking a theme applies it, stores it, and moves the tick', async () => {
    const ThemeSetting = await loadThemeSetting();
    render(<ThemeSetting />);

    fireEvent.click(screen.getByRole('radio', { name: 'Dark theme' }));

    expect(document.documentElement.dataset.theme).toBe('dark');
    expect(localStorage.getItem(THEME_KEY)).toBe('dark');
    expect(screen.getByRole('radio', { name: 'Dark theme' })).toBeChecked();
    expect(screen.getByRole('radio', { name: 'Match device theme' })).not.toBeChecked();
  });

  it('V3A-09 · it only draws: loading it changes nothing on the page', async () => {
    /*
     * The rule from docs/backlog.md: a component either draws or causes an effect,
     * not both. If the load-time sync crept back in here, it would silently depend
     * on Settings being open.
     */
    localStorage.setItem(THEME_KEY, 'dark');
    const ThemeSetting = await loadThemeSetting();
    render(<ThemeSetting />);

    expect(metas()).toEqual([
      { content: THEME_COLOURS.light, media: '(prefers-color-scheme: light)' },
      { content: THEME_COLOURS.dark, media: '(prefers-color-scheme: dark)' },
    ]);
    expect(document.documentElement.dataset.theme).toBeUndefined();
  });
});
