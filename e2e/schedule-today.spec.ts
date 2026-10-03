import { expect, test, type Page } from '@playwright/test';
import { envelope, goTo, habitRow, openApp, seed, streakBadge } from './helpers';

/*
 * v4 Block C: what a schedule changes on today's list, in a real browser.
 *
 * The clock is pinned to **Wednesday 30 September 2026, 09:00** local, because
 * every assertion here depends on what day it is. Without that, "a Mondays-only
 * habit is resting" would pass six days a week and fail on the seventh.
 */

const NOON_WEDNESDAY = new Date('2026-09-30T09:00:00+08:00');

async function openOn(page: Page, data: object) {
  await page.clock.install({ time: NOON_WEDNESDAY });
  await seed(page, data);
  await openApp(page);
}

/** The "2/3" in the section header. */
const counter = (page: Page) => page.locator('section', { hasText: "Today's habits" }).getByText(/^\d+\/\d+$/);

test('V4C-50 · ⭐ a habit that is not due today sits below the others, and says why', async ({ page }) => {
  await openOn(
    page,
    envelope({
      habits: [
        { id: 'h1', title: 'Yoga', schedule: 'weekdays:0' }, // Mondays
        { id: 'h2', title: 'Drink water' }, // every day
      ],
    }),
  );

  await expect(page.getByText('Not due today · Mondays')).toBeVisible();

  // Due first, resting after — whatever order they were added in.
  // The habits' own list: since v5 Block B the tab bar is a list on the page too.
  const rows = page
    .getByRole('list')
    .filter({ has: page.getByRole('checkbox', { name: 'Yoga', exact: true }) })
    .getByRole('listitem');
  await expect(rows.first()).toContainText('Drink water');
  await expect(rows.last()).toContainText('Yoga');

  // And visibly quieter, not merely lower down. The colour has to actually
  // differ; which colour it is, the contrast test guards.
  const colourOf = (title: string) =>
    page.getByText(title, { exact: true }).evaluate((el) => getComputedStyle(el).color);
  expect(await colourOf('Yoga')).not.toBe(await colourOf('Drink water'));
});

test('V4C-51 · ⭐ the count is of what is due today, and ticking a day-off habit cannot break it', async ({ page }) => {
  await openOn(
    page,
    envelope({
      habits: [
        { id: 'h1', title: 'Drink water' },
        { id: 'h2', title: 'Run', schedule: 'weekdays:0,2,4' }, // due: Wednesday
        { id: 'h3', title: 'Yoga', schedule: 'weekdays:6' }, // Sundays
      ],
    }),
  );

  await expect(counter(page)).toHaveText('0/2');

  await habitRow(page, 'Drink water').click();
  await expect(counter(page)).toHaveText('1/2');

  // Doing a habit on its day off is kept and shown — and never makes the
  // header read 3/2.
  await habitRow(page, 'Yoga').click();
  await expect(habitRow(page, 'Yoga')).toBeChecked();
  await expect(counter(page)).toHaveText('1/2');
});

test('V4C-52 · ⭐ a streak counts the days the habit was due, not the days between', async ({ page }) => {
  // Kept on Monday and Wednesday. For a Mon/Wed/Fri habit that is two in a
  // row; for an every-day habit the same history is a streak of one.
  const kept: [string, string][] = [
    ['h1', '2026-09-28'],
    ['h1', '2026-09-30'],
    ['h2', '2026-09-28'],
    ['h2', '2026-09-30'],
  ];
  await openOn(
    page,
    envelope({
      habits: [
        { id: 'h1', title: 'Run', schedule: 'weekdays:0,2,4' },
        { id: 'h2', title: 'Drink water' },
      ],
      completions: kept,
    }),
  );

  await expect(streakBadge(page, 2)).toBeVisible();
  await expect(streakBadge(page, 1)).toBeVisible();
});

test('V4C-53 · ⭐ a few-times-a-week habit counts its run in weeks, and stays put when ticked', async ({ page }) => {
  await openOn(
    page,
    envelope({
      habits: [{ id: 'h1', title: 'Gym', schedule: 'weekly:2' }],
      // Two last week (Mon 21, Wed 23) and one this week (Mon 28).
      completions: [
        ['h1', '2026-09-21'],
        ['h1', '2026-09-23'],
        ['h1', '2026-09-28'],
      ],
    }),
  );

  // One more this week meets the target of two.
  await expect(page.getByLabel('1 week in a row')).toBeVisible();
  await habitRow(page, 'Gym').click();

  await expect(page.getByLabel('2 weeks in a row')).toBeVisible();
  // Still on today's list, deliberately: the day you are looking at never
  // counts towards its own target, so ticking it can't make it disappear
  // under your thumb. Tomorrow it will be resting.
  await expect(page.getByText(/^Not due today/)).toHaveCount(0);
});

test('V4C-54 · ⭐ the strip marks a day off apart from a day missed, and it stays tappable', async ({ page }) => {
  await openOn(
    page,
    envelope({ habits: [{ id: 'h1', title: 'Run', schedule: 'weekdays:0,2,4' }] }),
  );

  const saturday = page.getByRole('button', { name: /Saturday, September 26/ });
  await expect(saturday).toHaveAccessibleName(/not due$/);
  await expect(saturday.locator('span')).toHaveAttribute('data-day-state', 'unscheduled');
  await expect(page.getByRole('button', { name: /Monday, September 28/ }).locator('span')).toHaveAttribute(
    'data-day-state',
    'missed',
  );

  await saturday.click();
  await expect(saturday).toHaveAccessibleName(/done$/);
});

test('V4C-55 · ⭐ the review marks days off apart from misses', async ({ page }) => {
  await openOn(
    page,
    envelope({
      habits: [{ id: 'h1', title: 'Run', schedule: 'weekdays:0,2,4' }],
      completions: [['h1', '2026-09-28']],
    }),
  );

  // The review is the Progress tab since v5 Block B.
  await goTo(page, 'Progress');
  const dialog = page.getByRole('region', { name: 'Last 4 weeks' });

  await expect(dialog.locator('[data-day="2026-09-29"]')).toHaveAttribute('data-day-state', 'unscheduled');
  await expect(dialog.locator('[data-day="2026-09-28"]')).toHaveAttribute('data-day-state', 'done');
  await expect(dialog.locator('[data-day="2026-09-25"]')).toHaveAttribute('data-day-state', 'missed');
  // "Kept 1 of N" counts only the days it was due, so a perfect week of a
  // three-day habit can read as perfect.
  await expect(dialog).toContainText(/Kept 1 of \d+ days/);
});
