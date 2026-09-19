import { expect, test, type Page } from '@playwright/test';
import { openApp, THEME_KEY } from './helpers';

/*
 * Ported from docs/qa/v0.5-b-theming.md. Since v3 Block A the three choices sit
 * in a menu behind one header button.
 */

const CREAM = 'rgb(255, 251, 247)'; // #FFFBF7
const PLUM = 'rgb(36, 23, 38)'; // #241726

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

const SHORT = { 'Light theme': 'Light', 'Dark theme': 'Dark', 'Match device theme': 'Match device' } as const;

function themeButton(page: Page) {
  return page.getByRole('button', { name: /^Theme:/ });
}

async function choose(page: Page, label: keyof typeof SHORT) {
  await themeButton(page).click();
  await page.getByRole('radio', { name: label }).click();
  // Picking closes the menu, and the button then names the new choice.
  await expect(page.getByRole('radio')).toHaveCount(0);
  await expect(themeButton(page)).toHaveAccessibleName(`Theme: ${SHORT[label]}`);
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
  await expect(themeButton(page)).toHaveAccessibleName('Theme: Dark');
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
    expect(await themeMetas(page)).toEqual([{ content: '#FFFBF7', media: null }]);
  });

  test('V2A-34 · forcing dark on a light device pins one plum colour', async ({ page }) => {
    await page.emulateMedia({ colorScheme: 'light' });
    await openApp(page);
    await choose(page, 'Dark theme');
    expect(await themeMetas(page)).toEqual([{ content: '#241726', media: null }]);
  });

  test('V3A-10 · ⭐ a stored dark theme pins the status bar on load, with the menu never opened', async ({ page }) => {
    /*
     * The catch from docs/backlog.md. The load-time sync used to live inside the
     * theme buttons; inside a menu that only exists while open it would never run,
     * leaving a cream status bar above a plum app. The inline script can't catch
     * this: it paints the colours but leaves the metas alone.
     */
    await page.emulateMedia({ colorScheme: 'light' });
    await page.addInitScript((key) => localStorage.setItem(key, 'dark'), THEME_KEY);
    await openApp(page);

    await expect(themeButton(page)).toHaveAttribute('aria-expanded', 'false');
    await expect.poll(() => themeMetas(page)).toEqual([{ content: '#241726', media: null }]);
  });

  test('V2A-35 · ⭐ switching back to "Match device" restores the pair', async ({ page }) => {
    // The bug found in v0.5 B: the bar stayed stuck on the last forced colour.
    await openApp(page);
    await choose(page, 'Dark theme');
    await choose(page, 'Match device theme');
    expect(await themeMetas(page)).toHaveLength(2);
  });
});
