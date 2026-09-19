// @vitest-environment jsdom
import { render } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { THEME_COLOURS, THEME_KEY } from '@/lib/theme';

/*
 * The theme preference is cached in a module (lib/useTheme.ts), so each test loads
 * a fresh copy after writing storage. That is what a page load does.
 */
async function loadThemeEffect() {
  vi.resetModules();
  return (await import('./ThemeEffect')).ThemeEffect;
}

function metas() {
  return [...document.head.querySelectorAll('meta[name="theme-color"]')].map((el) => ({
    content: el.getAttribute('content'),
    media: el.getAttribute('media'),
  }));
}

/** The pair the server renders into every page, before any script has run. */
function serverRenderedMetas() {
  document.head.innerHTML = `
    <meta name="theme-color" content="${THEME_COLOURS.light}" media="(prefers-color-scheme: light)">
    <meta name="theme-color" content="${THEME_COLOURS.dark}" media="(prefers-color-scheme: dark)">`;
}

beforeEach(() => {
  // jsdom has no matchMedia; the preference store listens to it for "Match device".
  window.matchMedia = ((query: string) => ({
    matches: false,
    media: query,
    addEventListener: () => {},
    removeEventListener: () => {},
  })) as unknown as typeof window.matchMedia;
  localStorage.clear();
  serverRenderedMetas();
  delete document.documentElement.dataset.theme;
});

describe('ThemeEffect', () => {
  it('V3A-01 · a stored dark theme pins a plum status bar on load, with nothing tapped', async () => {
    localStorage.setItem(THEME_KEY, 'dark');
    const ThemeEffect = await loadThemeEffect();

    render(<ThemeEffect />);

    expect(metas()).toEqual([{ content: THEME_COLOURS.dark, media: null }]);
    expect(document.documentElement.dataset.theme).toBe('dark');
  });

  it('V3A-02 · with no stored choice the browser keeps both colours and follows the device', async () => {
    const ThemeEffect = await loadThemeEffect();

    render(<ThemeEffect />);

    expect(metas()).toEqual([
      { content: THEME_COLOURS.light, media: '(prefers-color-scheme: light)' },
      { content: THEME_COLOURS.dark, media: '(prefers-color-scheme: dark)' },
    ]);
  });

  it('V3A-03 · draws nothing', async () => {
    const ThemeEffect = await loadThemeEffect();
    const { container } = render(<ThemeEffect />);
    expect(container).toBeEmptyDOMElement();
  });
});
