// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from 'vitest';
import { THEME_COLOURS, applyTheme } from './theme';

/**
 * Guards two status-bar bugs.
 *
 * Found in v0.5 Block B QA: `applyTheme` used to pin a single fixed colour in
 * every case. That quietly broke OS tracking — with "Match device" selected the
 * page followed the system, but the status bar kept whatever colour it had when
 * you last tapped.
 *
 * Found in v3 Block A CI: it used to *replace* the metas to do that. React
 * rendered them and still owns them, so the next page change crashed with
 * "removeChild of null" — which broke signing in, the one place the app changes
 * page. The metas are now only ever edited.
 */

const LIGHT_MEDIA = '(prefers-color-scheme: light)';
const DARK_MEDIA = '(prefers-color-scheme: dark)';

function metas() {
  return [...document.head.querySelectorAll('meta[name="theme-color"]')].map((el) => ({
    content: el.getAttribute('content'),
    media: el.getAttribute('media'),
  }));
}

beforeEach(() => {
  // What the layout renders into every page.
  document.head.innerHTML = `
    <meta name="theme-color" content="${THEME_COLOURS.light}" media="${LIGHT_MEDIA}">
    <meta name="theme-color" content="${THEME_COLOURS.dark}" media="${DARK_MEDIA}">`;
  delete document.documentElement.dataset.theme;
});

describe('applyTheme', () => {
  it('marks the document for an explicit dark choice', () => {
    applyTheme('dark');
    expect(document.documentElement.dataset.theme).toBe('dark');
  });

  it('removes the attribute for system, so CSS falls back to the media query', () => {
    applyTheme('dark');
    applyTheme('system');
    expect(document.documentElement.dataset.theme).toBeUndefined();
  });

  it('gives the status bar the forced colour whichever way the device is set', () => {
    applyTheme('dark');
    expect(metas()).toEqual([
      { content: THEME_COLOURS.dark, media: LIGHT_MEDIA },
      { content: THEME_COLOURS.dark, media: DARK_MEDIA },
    ]);

    applyTheme('light');
    expect(metas()).toEqual([
      { content: THEME_COLOURS.light, media: LIGHT_MEDIA },
      { content: THEME_COLOURS.light, media: DARK_MEDIA },
    ]);
  });

  it('hands the status bar back to the device for system', () => {
    applyTheme('system');
    expect(metas()).toEqual([
      { content: THEME_COLOURS.light, media: LIGHT_MEDIA },
      { content: THEME_COLOURS.dark, media: DARK_MEDIA },
    ]);
  });

  it('restores each colour when switching back from a forced theme', () => {
    applyTheme('dark');
    applyTheme('system');
    expect(metas()).toEqual([
      { content: THEME_COLOURS.light, media: LIGHT_MEDIA },
      { content: THEME_COLOURS.dark, media: DARK_MEDIA },
    ]);
  });

  it('V3A-12 · ⭐ edits the page’s own metas and never swaps them out', () => {
    // React owns these elements. Removing or replacing them crashes its next
    // update of the page head (the sign-in bug), so they must be the same nodes.
    const before = [...document.head.children];
    for (const preference of ['dark', 'system', 'light', 'system', 'dark'] as const) {
      applyTheme(preference);
      expect([...document.head.children]).toEqual(before);
      before.forEach((node) => expect(node.isConnected).toBe(true));
    }
  });

  it('V3A-14 · recolours every copy when the head holds two of each', () => {
    // What the head looks like after Next renders a page change (see ThemeEffect).
    document.head.insertAdjacentHTML(
      'beforeend',
      `<meta name="theme-color" content="${THEME_COLOURS.light}" media="${LIGHT_MEDIA}">
       <meta name="theme-color" content="${THEME_COLOURS.dark}" media="${DARK_MEDIA}">`,
    );
    applyTheme('dark');
    expect(metas().map((m) => m.content)).toEqual(Array(4).fill(THEME_COLOURS.dark));
  });

  it('adds its own pair only if the page has none', () => {
    document.head.innerHTML = '';
    applyTheme('dark');
    applyTheme('dark');
    expect(metas()).toEqual([
      { content: THEME_COLOURS.dark, media: LIGHT_MEDIA },
      { content: THEME_COLOURS.dark, media: DARK_MEDIA },
    ]);
  });
});
