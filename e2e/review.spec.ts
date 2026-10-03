import { expect, test, type Page } from '@playwright/test';
import { addHabit, goTo, openApp, seed, todayDot } from './helpers';

/*
 * v3 Block C's review: the last four weeks, habit by habit.
 *
 * It was a sheet over the app, opened from a calendar button in the header.
 * Since v5 Block B it is the bottom of the Progress tab. What it shows is
 * unchanged and keeps its tests; the two tests about the sheet itself are
 * retired — V3C-51 (Escape closes it, focus returns to the button) has no
 * sheet to close, and its accessibility promise now belongs to V5B-63 (focus
 * moves to each screen's heading). V3C-54 now measures the range buttons,
 * since the Close button it measured went with the sheet.
 */

const history = (page: Page) => page.getByRole('region', { name: 'Last 4 weeks' });

test('V3C-50 · ⭐ Progress shows four weeks of each habit, and Today is untouched', async ({ page }) => {
  await openApp(page);
  await addHabit(page, 'Drink water');
  await todayDot(page, 'Drink water').click();

  await goTo(page, 'Progress');
  const review = history(page);
  await expect(review.getByRole('heading', { name: 'Drink water' })).toBeVisible();
  // Four weeks of seven days, for the one habit.
  await expect(review.locator('[data-day-state]')).toHaveCount(28);
  await expect(review.locator('[data-day-state="done"]')).toHaveCount(1);

  await goTo(page, 'Today');
  await expect(page.getByRole('checkbox', { name: 'Drink water', exact: true })).toBeChecked();
});

test('V3C-52 · ⭐ nothing in the history can change your history', async ({ page }) => {
  await openApp(page);
  await addHabit(page, 'Drink water');
  await goTo(page, 'Progress');

  /*
   * Every button changes what you are looking at, never what you did: the two
   * ranges from v4 Block D. No day is tappable here — the seven-day strip on
   * Today is the only place a day can be changed.
   */
  const buttons = history(page).getByRole('button');
  await expect(buttons).toHaveCount(2);
  await expect(buttons.first()).toHaveText('4 weeks');
  await expect(page.locator('button[data-day], [data-day] button')).toHaveCount(0);
});

test('V3C-53 · ⭐ a habit made mid-window shows blank days before it, not misses', async ({ page }) => {
  // Seeded rather than clicked: "made three days ago" can't be typed into the app.
  const madeAt = new Date(Date.now() - 3 * 86_400_000).toISOString();
  await seed(page, {
    version: 2,
    state: {
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
    },
  });
  await openApp(page);
  await goTo(page, 'Progress');

  const review = history(page);
  await expect(review.locator('[data-day-state]')).toHaveCount(28);
  // Four days it could have been kept: three days ago through today.
  await expect(review.locator('[data-day-state="missed"]')).toHaveCount(4);
  await expect(review.getByText('Kept 0 of 4 days')).toBeVisible();
  // The other 24 are blank. How they split between "before it existed" and
  // "later this week" depends on which weekday the test runs on.
  await expect(review.locator('[data-day-state="before"], [data-day-state="future"]')).toHaveCount(24);
  await expect(review.locator('[data-day-state="done"]')).toHaveCount(0);
});

test.describe('at the smallest supported phone width', () => {
  test.use({ viewport: { width: 375, height: 812 } });

  test('V3C-54 · Progress fits the screen, with no sideways scroll', async ({ page }) => {
    await openApp(page);
    for (const title of ['Drink water', 'Stretch', 'A really quite long habit title that wraps']) {
      await addHabit(page, title);
    }
    await goTo(page, 'Progress');

    expect(
      await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth),
    ).toBe(false);

    for (const name of ['4 weeks', 'Year']) {
      const box = await page.getByRole('button', { name, exact: true }).boundingBox();
      expect(box!.height, name).toBeGreaterThanOrEqual(44);
    }
  });
});

test('V3C-55 · ⭐ Progress opens with no connection', async ({ page, context }) => {
  await openApp(page);
  await addHabit(page, 'Drink water');

  await context.setOffline(true);
  await goTo(page, 'Progress');

  await expect(history(page).getByRole('heading', { name: 'Drink water' })).toBeVisible();
  await expect(history(page).locator('[data-day-state]')).toHaveCount(28);
  await context.setOffline(false);
});
