// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from 'vitest';
import { THEME_COLOURS, applyTheme } from './theme';

/**
 * Guards the status-bar bug found in Block B QA: `applyTheme` used to replace the
 * two media-scoped `theme-color` metas with a single fixed one in every case.
 * That quietly broke OS tracking — with "Match device" selected the page followed
 * the system, but the status bar kept whatever colour it had when you last tapped.
 */

function metas() {
  return [...document.head.querySelectorAll('meta[name="theme-color"]')].map((el) => ({
    content: el.getAttribute('content'),
    media: el.getAttribute('media'),
  }));
}

beforeEach(() => {
  document.head.innerHTML = '';
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

  it('pins one unconditional status-bar colour when a theme is forced', () => {
    applyTheme('dark');
    expect(metas()).toEqual([{ content: THEME_COLOURS.dark, media: null }]);

    applyTheme('light');
    expect(metas()).toEqual([{ content: THEME_COLOURS.light, media: null }]);
  });

  it('hands the status bar back to the browser for system', () => {
    applyTheme('system');
    expect(metas()).toEqual([
      { content: THEME_COLOURS.light, media: '(prefers-color-scheme: light)' },
      { content: THEME_COLOURS.dark, media: '(prefers-color-scheme: dark)' },
    ]);
  });

  it('restores the media pair when switching back from a forced theme', () => {
    applyTheme('dark');
    expect(metas()).toHaveLength(1);

    applyTheme('system');
    expect(metas()).toHaveLength(2);
    expect(metas().every((m) => m.media !== null)).toBe(true);
  });

  it('never leaves duplicate metas behind when applied repeatedly', () => {
    for (const preference of ['dark', 'system', 'light', 'system', 'dark'] as const) {
      applyTheme(preference);
    }
    applyTheme('system');
    expect(metas()).toHaveLength(2);
  });
});
