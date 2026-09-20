import { expect, test, type Page } from '@playwright/test';
import { addHabit, openApp, seed, todayDot } from './helpers';

/*
 * v3 Block C: the last four weeks, as a sheet over the app.
 */

const openReview = (page: Page) => page.getByRole('button', { name: 'Review the last 4 weeks' }).click();
const sheet = (page: Page) => page.getByRole('dialog', { name: 'Last 4 weeks' });

test('V3C-50 · ⭐ the review opens over the app, shows four weeks, and closes again', async ({ page }) => {
  await openApp(page);
  await addHabit(page, 'Drink water');
  await todayDot(page, 'Drink water').click();

  await openReview(page);
  const review = sheet(page);
  await expect(review).toBeVisible();
  await expect(review.getByRole('heading', { name: 'Drink water' })).toBeVisible();
  // Four weeks of seven days, for the one habit.
  await expect(review.locator('[data-day-state]')).toHaveCount(28);
  await expect(review.locator('[data-day-state="done"]')).toHaveCount(1);

  await page.getByRole('button', { name: 'Close review' }).click();
  await expect(sheet(page)).toHaveCount(0);
  // Back to the app, with the habit still there.
  await expect(page.getByRole('checkbox', { name: 'Drink water', exact: true })).toBeChecked();
});

test('V3C-51 · Escape closes it and focus goes back to the button', async ({ page }) => {
  await openApp(page);
  await addHabit(page, 'Drink water');

  await openReview(page);
  await expect(page.getByRole('button', { name: 'Close review' })).toBeFocused();
  await page.keyboard.press('Escape');

  await expect(sheet(page)).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Review the last 4 weeks' })).toBeFocused();
});

test('V3C-52 · ⭐ nothing in the review can change your history', async ({ page }) => {
  await openApp(page);
  await addHabit(page, 'Drink water');
  await openReview(page);

  const buttons = sheet(page).getByRole('button');
  await expect(buttons).toHaveCount(1);
  await expect(buttons).toHaveAccessibleName('Close review');
});

test('V3C-53 · ⭐ a habit made mid-window shows blank days before it, not misses', async ({ page }) => {
  // Seeded rather than clicked: "made three days ago" can't be typed into the app.
  // The shared envelope() helper dates every habit the same, so this one is written out.
  const madeAt = new Date(Date.now() - 3 * 86_400_000).toISOString();
  await seed(page, {
    habits: [
      {
        id: '11111111-1111-4111-8111-111111111111',
        title: 'New habit',
        createdAt: madeAt,
        updatedAt: madeAt,
        archivedAt: null,
        deletedAt: null,
        position: 'V',
      },
    ],
    tasks: [],
    completions: {},
  });
  await openApp(page);
  await openReview(page);

  const review = sheet(page);
  await expect(review.locator('[data-day-state]')).toHaveCount(28);
  // Four days it could have been kept (three days ago through today), the rest blank.
  await expect(review.locator('[data-day-state="missed"]')).toHaveCount(4);
  await expect(review.locator('[data-day-state="before"]')).toHaveCount(24);
  await expect(review.getByText('Kept 0 of 4 days')).toBeVisible();
});

test.describe('at the smallest supported phone width', () => {
  test.use({ viewport: { width: 375, height: 812 } });

  test('V3C-54 · the sheet fits the screen, with no sideways scroll', async ({ page }) => {
    await openApp(page);
    for (const title of ['Drink water', 'Stretch', 'A really quite long habit title that wraps']) {
      await addHabit(page, title);
    }
    await openReview(page);

    await expect(sheet(page)).toBeVisible();
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth),
    ).toBe(false);

    const close = await page.getByRole('button', { name: 'Close review' }).boundingBox();
    expect(close!.width).toBeGreaterThanOrEqual(44);
    expect(close!.height).toBeGreaterThanOrEqual(44);
  });
});

test('V3C-55 · ⭐ the review opens with no connection', async ({ page, context }) => {
  await openApp(page);
  await addHabit(page, 'Drink water');

  await context.setOffline(true);
  await openReview(page);

  await expect(sheet(page).getByRole('heading', { name: 'Drink water' })).toBeVisible();
  await expect(sheet(page).locator('[data-day-state]')).toHaveCount(28);
  await context.setOffline(false);
});
