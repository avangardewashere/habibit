// @vitest-environment jsdom
import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { THEME_COLOURS, THEME_KEY } from '@/lib/theme';

/* As in ThemeEffect.test.tsx: a fresh copy of the cached preference per test, like a page load. */
async function loadThemeMenu() {
  vi.resetModules();
  return (await import('./ThemeMenu')).ThemeMenu;
}

function metas() {
  return [...document.head.querySelectorAll('meta[name="theme-color"]')].map((el) => ({
    content: el.getAttribute('content'),
    media: el.getAttribute('media'),
  }));
}

const themeButton = () => screen.getByRole('button', { name: /^Theme:/ });

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

describe('ThemeMenu', () => {
  it('V3A-05 · starts as one button that names the current theme, with no options showing', async () => {
    localStorage.setItem(THEME_KEY, 'dark');
    const ThemeMenu = await loadThemeMenu();
    render(<ThemeMenu />);

    expect(themeButton()).toHaveAccessibleName('Theme: Dark');
    expect(themeButton()).toHaveAttribute('aria-expanded', 'false');
    expect(screen.queryAllByRole('radio')).toHaveLength(0);
  });

  it('V3A-06 · opening shows the three themes with the current one ticked', async () => {
    const ThemeMenu = await loadThemeMenu();
    render(<ThemeMenu />);

    fireEvent.click(themeButton());

    expect(themeButton()).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByRole('radiogroup', { name: 'Colour theme' })).toBeInTheDocument();
    expect(screen.getAllByRole('radio').map((r) => r.getAttribute('aria-label'))).toEqual([
      'Light theme',
      'Dark theme',
      'Match device theme',
    ]);
    expect(screen.getByRole('radio', { name: 'Match device theme' })).toBeChecked();
  });

  it('V3A-07 · picking a theme applies and stores it, closes the menu and returns focus', async () => {
    const ThemeMenu = await loadThemeMenu();
    render(<ThemeMenu />);

    fireEvent.click(themeButton());
    fireEvent.click(screen.getByRole('radio', { name: 'Dark theme' }));

    expect(document.documentElement.dataset.theme).toBe('dark');
    expect(localStorage.getItem(THEME_KEY)).toBe('dark');
    expect(screen.queryAllByRole('radio')).toHaveLength(0);
    expect(themeButton()).toHaveAccessibleName('Theme: Dark');
    expect(themeButton()).toHaveFocus();
  });

  it('V3A-08 · Escape closes it and returns focus; a tap outside closes it', async () => {
    const ThemeMenu = await loadThemeMenu();
    render(<ThemeMenu />);

    fireEvent.click(themeButton());
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(screen.queryAllByRole('radio')).toHaveLength(0);
    expect(themeButton()).toHaveFocus();

    fireEvent.click(themeButton());
    fireEvent.pointerDown(document.body);
    expect(screen.queryAllByRole('radio')).toHaveLength(0);
  });

  it('V3A-09 · the menu only draws: loading it changes nothing on the page', async () => {
    /*
     * The rule from docs/backlog.md: a component either draws or causes an effect,
     * not both. If the load-time sync crept back in here, it would silently depend
     * on this component being mounted again.
     */
    localStorage.setItem(THEME_KEY, 'dark');
    const ThemeMenu = await loadThemeMenu();
    render(<ThemeMenu />);

    expect(metas()).toHaveLength(2);
    expect(document.documentElement.dataset.theme).toBeUndefined();
  });
});
