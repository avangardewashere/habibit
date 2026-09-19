import { expect, test, type Locator, type Page } from '@playwright/test';
import { addHabit, addTask, moreActions, openApp } from './helpers';

/*
 * Ported from the layout, tap-target and PWA rows across every v0–v1 checklist.
 * Sizes are measured on the rendered page, the same way they were by hand.
 */

const MIN_TAP = 44;

async function box(locator: Locator) {
  const b = await locator.boundingBox();
  if (!b) throw new Error('element has no box');
  return b;
}

async function hasSidewaysScroll(page: Page) {
  return page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth);
}

test.describe('at the smallest supported phone width', () => {
  test.use({ viewport: { width: 375, height: 812 } });

  test('V2A-36 · no sideways scroll, even with long titles and the menu open', async ({ page }) => {
    await openApp(page);
    await addHabit(page, 'A really quite long habit title that has to wrap somewhere sensible');
    await addTask(page, 'Supercalifragilisticexpialidociousandthensomemoretext');
    expect(await hasSidewaysScroll(page)).toBe(false);

    await moreActions(page, 'A really quite long habit title that has to wrap somewhere sensible').click();
    expect(await hasSidewaysScroll(page)).toBe(false);

    // Both pills stay inside the card.
    const card = await box(page.locator('section').first().locator('.rounded-card').first());
    const del = await box(page.getByRole('button', { name: /^Delete A really/ }));
    expect(del.x + del.width).toBeLessThanOrEqual(card.x + card.width);
  });

  test('V3A-11 · the open theme menu fits on screen, with no sideways scroll', async ({ page }) => {
    await openApp(page);
    await page.getByRole('button', { name: /^Theme:/ }).click();

    const menu = await box(page.getByRole('radiogroup', { name: 'Colour theme' }));
    expect(menu.x).toBeGreaterThanOrEqual(0);
    expect(menu.x + menu.width).toBeLessThanOrEqual(375);
    expect(await hasSidewaysScroll(page)).toBe(false);
  });

  test('V2A-37 · every tap target is at least 44×44', async ({ page }) => {
    await openApp(page);
    await addHabit(page, 'Drink water');

    const targets = [
      // Only in builds with accounts switched on, which the browser tests always are.
      ...(await page.getByRole('button', { name: /^Account:/ }).all()),
      page.getByRole('button', { name: /^Theme:/ }),
      moreActions(page, 'Drink water'),
      page.getByRole('button', { name: 'Add habit' }),
      page.getByRole('button', { name: 'Add task' }),
      ...(await page.getByRole('button', { name: /^Drink water — / }).all()),
    ];

    // The theme choices only exist while their menu is open.
    await page.getByRole('button', { name: /^Theme:/ }).click();
    targets.push(...(await page.getByRole('radio').all()));
    expect(targets.length).toBeGreaterThanOrEqual(14);

    for (const target of targets) {
      const b = await box(target);
      expect.soft(b.width, await target.getAttribute('aria-label') ?? '').toBeGreaterThanOrEqual(MIN_TAP);
      expect.soft(b.height, await target.getAttribute('aria-label') ?? '').toBeGreaterThanOrEqual(MIN_TAP);
    }
  });
});

test('V2A-38 · pasting a list adds one habit per line', async ({ page, browserName }) => {
  test.skip(browserName !== 'chromium', 'clipboard permissions are Chromium-only');
  await page.context().grantPermissions(['clipboard-read', 'clipboard-write']);
  await openApp(page);

  const input = page.getByRole('textbox', { name: 'Add a habit...' });
  await input.focus();
  await page.evaluate(() => navigator.clipboard.writeText('Drink water\nStretch\n\nRead'));
  await page.keyboard.press('ControlOrMeta+V');

  await expect(page.getByRole('checkbox', { name: 'Drink water', exact: true })).toBeVisible();
  await expect(page.getByRole('checkbox', { name: 'Stretch', exact: true })).toBeVisible();
  await expect(page.getByRole('checkbox', { name: 'Read', exact: true })).toBeVisible();
  await expect(page.getByText('0/3', { exact: true })).toBeVisible();
  await expect(input).toHaveValue('');
});

test('V2A-39 · the console stays clean through a normal session', async ({ page }) => {
  // Hydration mismatches show up here as errors, and they are easy to introduce.
  const problems: string[] = [];
  page.on('console', (msg) => {
    if (msg.type() === 'error' || msg.type() === 'warning') problems.push(msg.text());
  });
  page.on('pageerror', (err) => problems.push(err.message));

  await openApp(page);
  await addHabit(page, 'Drink water');
  await addTask(page, 'Call mum');
  await page.getByRole('checkbox', { name: 'Drink water', exact: true }).click();
  await page.getByRole('button', { name: /^Theme:/ }).click();
  await page.getByRole('radio', { name: 'Dark theme' }).click();
  await page.reload();
  await expect(page.getByRole('checkbox', { name: 'Drink water', exact: true })).toBeChecked();

  expect(problems).toEqual([]);
});

test.describe('installing as an app', () => {
  test('V2A-40 · the manifest is served and describes the app', async ({ request }) => {
    const res = await request.get('/manifest.webmanifest');
    expect(res.ok()).toBe(true);
    const manifest = await res.json();

    expect(manifest).toMatchObject({
      id: '/',
      name: 'Habibit',
      start_url: '/',
      display: 'standalone',
      background_color: '#FFFBF7',
    });
    const purposes = manifest.icons.map((i: { purpose: string }) => i.purpose);
    expect(purposes).toContain('any');
    expect(purposes).toContain('maskable');
  });

  test('V2A-41 · every icon the app points to actually exists', async ({ page, request }) => {
    const manifest = await (await request.get('/manifest.webmanifest')).json();
    await openApp(page);
    const linked = await page.evaluate(() =>
      [...document.querySelectorAll('link[rel="icon"], link[rel="apple-touch-icon"], link[rel="manifest"]')].map(
        (l) => l.getAttribute('href') ?? '',
      ),
    );

    const urls = [...manifest.icons.map((i: { src: string }) => i.src), ...linked];
    expect(linked.length).toBeGreaterThanOrEqual(3);

    for (const url of urls) {
      const res = await request.get(url);
      expect.soft(res.status(), url).toBe(200);
    }
  });
});
