import { expect, test, type Page } from '@playwright/test';
import { addHabit, addTask, envelope, goTo, moreActions, offlineReady, openApp, seed, streakBadge } from './helpers';

/*
 * v5 Block B: the three places, in a real browser.
 *
 * The tabs are views of one page held in the address's hash. That choice is
 * only worth anything if the browser treats them as places: Back walks back,
 * a refresh stays put, a link opens the right one — with or without a signal.
 */

const nav = (page: Page) => page.getByRole('navigation', { name: 'Main' });
const heading = (page: Page, name: string) => page.getByRole('heading', { level: 1, name });

test('V5B-60 · ⭐ tapping a tab goes there, the address says so, and Back walks back', async ({ page }) => {
  await openApp(page);
  await expect(nav(page).getByRole('link', { name: 'Today' })).toHaveAttribute('aria-current', 'page');

  await goTo(page, 'Progress');
  await expect(page).toHaveURL(/#progress$/);
  await goTo(page, 'Settings');
  await expect(page).toHaveURL(/#settings$/);
  await expect(nav(page).getByRole('link', { name: 'Settings' })).toHaveAttribute('aria-current', 'page');

  await page.goBack();
  await expect(heading(page, 'Progress')).toBeVisible();
  await page.goBack();
  await expect(heading(page, 'Habibit')).toBeVisible();
});

test('V5B-61 · ⭐ a refresh stays on the tab, and a link straight to one opens it', async ({ page }) => {
  await openApp(page);
  await goTo(page, 'Settings');
  await page.reload();
  await expect(heading(page, 'Settings')).toBeVisible();

  await page.goto('/#progress');
  await expect(heading(page, 'Progress')).toBeVisible();
});

test('V5B-62 · ⭐ moving between tabs never reloads the page', async ({ page }) => {
  // If a tab were a page load, everything kept only in memory would be lost on
  // the way — and the app would flash on every tap.
  await openApp(page);
  await page.evaluate(() => ((window as unknown as { marker: number }).marker = 42));

  await goTo(page, 'Progress');
  await goTo(page, 'Settings');
  await goTo(page, 'Today');

  expect(await page.evaluate(() => (window as unknown as { marker?: number }).marker)).toBe(42);
});

test('V5B-63 · ⭐ a new tab moves focus to its heading, as a new page would', async ({ page }) => {
  await openApp(page);
  await goTo(page, 'Progress');
  await expect(heading(page, 'Progress')).toBeFocused();
  await goTo(page, 'Today');
  await expect(heading(page, 'Habibit')).toBeFocused();
});

test('V5B-64 · ⭐ with no connection, a link to a tab still opens that tab', async ({ page, context }) => {
  /*
   * The reason the tabs are a hash and not three pages. Offline, an address the
   * service worker hasn't seen falls back to the one page it keeps — which
   * would have shown Today for "/progress". A hash never leaves the browser.
   */
  await seed(page, envelope({ habits: [{ id: 'h1', title: 'Drink water' }] }));
  await openApp(page);
  await offlineReady(page);

  await context.setOffline(true);
  await page.goto('/#settings');
  await expect(heading(page, 'Settings')).toBeVisible();
  await goTo(page, 'Progress');
  await expect(page.getByRole('region', { name: 'Last 4 weeks' }).getByRole('heading', { name: 'Drink water' })).toBeVisible();
  await context.setOffline(false);
});

test.describe('on a phone', () => {
  test.use({ viewport: { width: 375, height: 667 } });

  test('V5B-65 · ⭐ the tab bar never sits on top of the last thing on the screen', async ({ page }) => {
    await openApp(page);
    for (const title of ['Drink water', 'Stretch', 'Read', 'Meditate', 'Walk']) await addHabit(page, title);
    for (const title of ['Book the dentist', 'Call the bank']) await addTask(page, title);

    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    const last = await page.getByRole('checkbox', { name: 'Call the bank', exact: true }).boundingBox();
    const bar = await nav(page).boundingBox();
    expect(last!.y + last!.height).toBeLessThanOrEqual(bar!.y);

    await goTo(page, 'Settings');
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    const privacy = await page.getByRole('link', { name: 'Privacy' }).boundingBox();
    expect(privacy!.y + privacy!.height).toBeLessThanOrEqual((await nav(page).boundingBox())!.y);
  });

  test('V5B-66 · ⭐ the undo bar appears above the tab bar, not underneath it', async ({ page }) => {
    await openApp(page);
    await addHabit(page, 'Stretch');
    await moreActions(page, 'Stretch').click();
    await page.getByRole('button', { name: /^Delete Stretch/ }).click();

    const undo = await page.getByRole('button', { name: /^Undo/ }).boundingBox();
    const bar = await nav(page).boundingBox();
    expect(undo!.y + undo!.height).toBeLessThanOrEqual(bar!.y);
  });

  test('V5B-67 · each tab is comfortable to tap', async ({ page }) => {
    await openApp(page);
    for (const name of ['Today', 'Progress', 'Settings']) {
      const box = await nav(page).getByRole('link', { name }).boundingBox();
      expect(box!.height, name).toBeGreaterThanOrEqual(44);
      expect(box!.width, name).toBeGreaterThanOrEqual(44);
    }
  });
});

test('V5B-68 · ⭐ Progress agrees with Today about the same habit', async ({ page }) => {
  // Five days in a row, today included.
  const day = (n: number) => {
    const d = new Date();
    d.setDate(d.getDate() - n);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  };
  await seed(
    page,
    envelope({
      habits: [{ id: 'h1', title: 'Drink water' }],
      completions: [0, 1, 2, 3, 4].map((n) => ['h1', day(n)] as [string, string]),
    }),
  );
  await openApp(page);
  await expect(streakBadge(page, 5)).toBeVisible();

  await goTo(page, 'Progress');
  const tiles = page.getByRole('region', { name: 'Highlights' });
  await expect(tiles).toContainText('5days');
  await expect(tiles).toContainText('Drink water');
  await expect(page.getByRole('region', { name: 'Highlights' })).toContainText(/5\s*Check-ins/);
});

test('V5B-69 · the review button and theme button have left the header', async ({ page }) => {
  await openApp(page);
  await expect(page.getByRole('button', { name: 'Review the last 4 weeks' })).toHaveCount(0);
  await expect(page.getByRole('button', { name: /^Theme:/ })).toHaveCount(0);
});
