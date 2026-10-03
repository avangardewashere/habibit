import { expect, test, type Page } from '@playwright/test';
import { goTo, openApp, THEME_KEY } from './helpers';

/*
 * Ported from docs/qa/v0.5-b-theming.md. From v3 Block A the three choices sat
 * in a menu behind a header button; since v5 Block B they are three rows in
 * Settings. Every check below is about what the theme *does*, so they carry
 * over unchanged — only how you reach the choice is different.
 */

const CREAM = 'rgb(255, 251, 247)'; // #FFFBF7
const PLUM = 'rgb(36, 23, 38)'; // #241726

const LIGHT_MEDIA = '(prefers-color-scheme: light)';
const DARK_MEDIA = '(prefers-color-scheme: dark)';
/** A forced theme gives both metas its colour: the bar matches whichever way the device is set. */
const pinned = (colour: string) => [
  { content: colour, media: LIGHT_MEDIA },
  { content: colour, media: DARK_MEDIA },
];

async function themeMetas(page: Page) {
  return page.evaluate(() =>
    [...document.head.querySelectorAll('meta[name="theme-color"]')].map((m) => ({
      content: m.getAttribute('content'),
      media: m.getAttribute('media'),
    })),
  );
}

async function pageBackground(page: Page) {
  return page.evaluate(() => getComputedStyle(document.body).backgroundColor);
}

type ThemeName = 'Light theme' | 'Dark theme' | 'Match device theme';

const themeRow = (page: Page, label: ThemeName) => page.getByRole('radio', { name: label });

/** Picks a theme in Settings, going there first if need be, and checks it took. */
async function choose(page: Page, label: ThemeName) {
  if ((await page.getByRole('radiogroup', { name: 'Colour theme' }).count()) === 0) await goTo(page, 'Settings');
  await themeRow(page, label).click();
  await expect(themeRow(page, label)).toBeChecked();
}

test('V2A-29 · ⭐ a stored dark theme is applied before any app markup exists (no white flash)', async ({ page }) => {
  /*
   * "No flash" cannot be screenshotted reliably, but its cause can be checked
   * exactly: the theme attribute must already be on <html> when the browser
   * first parses the app's content. A MutationObserver installed before the
   * page loads records the attribute at the moment the <header> arrives.
   */
  await page.addInitScript((key) => {
    localStorage.setItem(key, 'dark');
    const w = window as unknown as { themeWhenHeaderArrived?: string | null };
    new MutationObserver((_, observer) => {
      if (document.querySelector('header')) {
        w.themeWhenHeaderArrived = document.documentElement.dataset.theme ?? null;
        observer.disconnect();
      }
    }).observe(document, { childList: true, subtree: true });
  }, THEME_KEY);

  await openApp(page);

  const seen = await page.evaluate(() => (window as unknown as { themeWhenHeaderArrived?: string | null }).themeWhenHeaderArrived);
  expect(seen).toBe('dark');
  expect(await pageBackground(page)).toBe(PLUM);
});

test('V2A-30 · light and dark apply, and the choice survives a reload', async ({ page }) => {
  await openApp(page);

  await choose(page, 'Dark theme');
  await expect.poll(() => pageBackground(page)).toBe(PLUM);
  await page.reload();
  // Still on Settings after the reload: the tab is in the address.
  await expect(themeRow(page, 'Dark theme')).toBeChecked();
  await expect.poll(() => pageBackground(page)).toBe(PLUM);

  await choose(page, 'Light theme');
  await expect.poll(() => pageBackground(page)).toBe(CREAM);
});

test('V2A-31 · "Match device" follows the OS and stores nothing', async ({ page }) => {
  await openApp(page);
  await choose(page, 'Dark theme');
  await choose(page, 'Match device theme');

  expect(await page.evaluate((key) => localStorage.getItem(key), THEME_KEY)).toBeNull();

  await page.emulateMedia({ colorScheme: 'dark' });
  await expect.poll(() => pageBackground(page)).toBe(PLUM);
  await page.emulateMedia({ colorScheme: 'light' });
  await expect.poll(() => pageBackground(page)).toBe(CREAM);
});

test.describe('the status bar colour', () => {
  test('V2A-32 · on "Match device" the browser gets both media-scoped colours', async ({ page }) => {
    await openApp(page);
    expect(await themeMetas(page)).toEqual([
      { content: '#FFFBF7', media: '(prefers-color-scheme: light)' },
      { content: '#241726', media: '(prefers-color-scheme: dark)' },
    ]);
  });

  test('V2A-33 · forcing light on a dark device pins one cream colour', async ({ page }) => {
    await page.emulateMedia({ colorScheme: 'dark' });
    await openApp(page);
    await choose(page, 'Light theme');
    expect(await themeMetas(page)).toEqual(pinned('#FFFBF7'));
  });

  test('V2A-34 · forcing dark on a light device pins one plum colour', async ({ page }) => {
    await page.emulateMedia({ colorScheme: 'light' });
    await openApp(page);
    await choose(page, 'Dark theme');
    expect(await themeMetas(page)).toEqual(pinned('#241726'));
  });

  test('V3A-10 · ⭐ a stored dark theme pins the status bar on load, with Settings never opened', async ({ page }) => {
    /*
     * The catch from docs/backlog.md. The load-time sync used to live inside the
     * theme buttons; inside something that only exists while open — a menu then,
     * the Settings tab now — it would never run, leaving a cream status bar above
     * a plum app. The inline script can't catch this: it paints the colours but
     * leaves the metas alone.
     */
    await page.emulateMedia({ colorScheme: 'light' });
    await page.addInitScript((key) => localStorage.setItem(key, 'dark'), THEME_KEY);
    await openApp(page);

    await expect(page.getByRole('radiogroup', { name: 'Colour theme' })).toHaveCount(0);
    await expect.poll(() => themeMetas(page)).toEqual(pinned('#241726'));
  });

  test('V2A-35 · ⭐ switching back to "Match device" restores the pair', async ({ page }) => {
    // The bug found in v0.5 B: the bar stayed stuck on the last forced colour.
    await openApp(page);
    await choose(page, 'Dark theme');
    await choose(page, 'Match device theme');
    expect(await themeMetas(page)).toEqual([
      { content: '#FFFBF7', media: LIGHT_MEDIA },
      { content: '#241726', media: DARK_MEDIA },
    ]);
  });

  test('V3A-13 · ⭐ with a theme forced, leaving the sign-in page for the app still works', async ({ page }) => {
    /*
     * Found by CI in this block. Replacing the metas (instead of editing them)
     * made React crash on its next change to the page head, so the hop from the
     * sign-in link's landing page back to the app died with "removeChild of null".
     * The link-less landing page takes the same hop, without needing an account.
     */
    const errors: string[] = [];
    page.on('pageerror', (err) => errors.push(err.message));
    await page.addInitScript((key) => localStorage.setItem(key, 'dark'), THEME_KEY);

    await page.goto('/auth/confirm');
    await page.getByRole('link', { name: 'Back to Habibit' }).click();

    await expect(page).toHaveURL(/\/$/);
    await expect(page.getByRole('textbox', { name: 'Add a habit...' })).toBeVisible();
    await expect(page).toHaveTitle(/Little habits/);
    expect(errors).toEqual([]);
    // And the status bar is still plum after the hop: every theme-color meta, including
    // any fresh ones Next rendered for the new page.
    await expect.poll(async () => (await themeMetas(page)).every((m) => m.content === '#241726')).toBe(true);
  });
});
