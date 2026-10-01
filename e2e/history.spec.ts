import { expect, test, type Page } from '@playwright/test';
import { envelope, openApp, seed } from './helpers';

/*
 * v4 Block D: a year of one habit, in a real browser.
 *
 * The clock is pinned to Wednesday 30 September 2026 because every date here
 * depends on it, and a year view is the one place where being a day out shows.
 */

const WEDNESDAY = new Date('2026-09-30T09:00:00+08:00');

/** Mondays and Wednesdays through September, plus one much older run. */
const KEPT: [string, string][] = [
  ['h1', '2026-09-07'],
  ['h1', '2026-09-09'],
  ['h1', '2026-09-14'],
  ['h1', '2026-09-16'],
  ['h1', '2026-09-21'],
  ['h1', '2026-09-23'],
  ['h1', '2026-09-28'],
  ['h1', '2026-09-30'],
];

async function openReview(page: Page, data: object) {
  await page.clock.install({ time: WEDNESDAY });
  await seed(page, data);
  await openApp(page);
  await page.getByRole('button', { name: 'Review the last 4 weeks' }).click();
  return page.getByRole('dialog');
}

const yearView = (page: Page) => page.getByRole('button', { name: 'Year', exact: true });

test('V4D-50 · ⭐ the year view shows a whole year, and says which year', async ({ page }) => {
  const sheet = await openReview(
    page,
    envelope({ habits: [{ id: 'h1', title: 'Run', schedule: 'weekdays:0,2' }], completions: KEPT }),
  );

  await expect(sheet).toContainText('Last 4 weeks');
  await yearView(page).click();

  await expect(sheet.getByRole('heading', { name: 'Last year' })).toBeVisible();
  // Both years named: without them a year reads as "29 Sept – 1 Oct".
  await expect(sheet).toContainText('29 Sept 2025 – 30 Sept 2026');
  await expect(sheet.locator('[data-day]')).toHaveCount(371);
  await expect(sheet.locator('[data-day="2026-09-30"]')).toHaveAttribute('data-day-state', 'done');
  await expect(sheet.locator('[data-day="2026-09-29"]')).toHaveAttribute('data-day-state', 'unscheduled');
});

test('V4D-51 · ⭐ the year view adds the best run ever and how long you have been at it', async ({ page }) => {
  const sheet = await openReview(
    page,
    envelope({ habits: [{ id: 'h1', title: 'Run', schedule: 'weekdays:0,2' }], completions: KEPT }),
  );

  // Not in the four-week view: it would be about time the squares don't show.
  await expect(sheet).not.toContainText('Best ever');

  await yearView(page).click();
  await expect(sheet).toContainText('Best ever 8 days in a row');
  await expect(sheet).toContainText('kept 8 times over');
});

test('V4D-52 · ⭐ a habit made days ago shows a year of nothing, not a year of misses', async ({ page }) => {
  const sheet = await openReview(
    page,
    envelope({ habits: [{ id: 'h1', title: 'Stretch' }], completions: [['h1', '2026-09-29']] }),
  );
  await yearView(page).click();

  // Seeded habits are created on 1 September 2026, so everything before that
  // belongs to no habit at all.
  await expect(sheet.locator('[data-day="2026-03-02"]')).toHaveAttribute('data-day-state', 'before');
  await expect(sheet.locator('[data-day-state="missed"]')).toHaveCount(29);
});

test('V4D-53 · the year fits a phone, and the two choices are comfortable taps', async ({ page }) => {
  const sheet = await openReview(
    page,
    envelope({
      habits: [
        { id: 'h1', title: 'Run', schedule: 'weekdays:0,2' },
        { id: 'h2', title: 'A habit with a very long name that has to wrap inside its own card' },
      ],
      completions: KEPT,
    }),
  );
  await yearView(page).click();
  await expect(sheet.locator('[data-day]').first()).toBeVisible();

  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  expect(overflow).toBeLessThanOrEqual(0);

  for (const name of ['4 weeks', 'Year']) {
    const box = await page.getByRole('button', { name, exact: true }).boundingBox();
    expect(box!.height, name).toBeGreaterThanOrEqual(44);
  }
});
