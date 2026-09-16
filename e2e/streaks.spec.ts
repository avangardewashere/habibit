import { expect, test } from '@playwright/test';
import { envelope, habitRow, openApp, seed, streakBadge, todayDot } from './helpers';

/*
 * Ported from docs/qa/v1-a-streaks.md.
 *
 * Playwright's fake clock replaces "change your OS clock and come back", which
 * was the one v1 check that could only be done by hand. Times are written with
 * an explicit +08:00 offset to match the Asia/Manila zone in the config.
 */

const WEEK = envelope({
  habits: [
    { id: 'h1', title: 'Drink water' },
    { id: 'h2', title: 'Stretch' },
  ],
  // A four-day run ending today, the 16th. Stretch has no history at all.
  completions: [
    ['h1', '2026-09-13'],
    ['h1', '2026-09-14'],
    ['h1', '2026-09-15'],
    ['h1', '2026-09-16'],
  ],
});

test('V2A-22 · seven dots per habit, ending at today', async ({ page }) => {
  await page.clock.setFixedTime(new Date('2026-09-16T12:00:00+08:00'));
  await seed(page, WEEK);
  await openApp(page);

  const dots = page.getByRole('button', { name: /^Drink water — / });
  await expect(dots).toHaveCount(7);
  await expect(dots.first()).toHaveAccessibleName(/Thursday, September 10/);
  await expect(dots.last()).toHaveAccessibleName(/Wednesday, September 16 \(today\)/);
});

test('V2A-23 · streaks count per habit and are hidden at zero', async ({ page }) => {
  await page.clock.setFixedTime(new Date('2026-09-16T12:00:00+08:00'));
  await seed(page, WEEK);
  await openApp(page);

  await expect(streakBadge(page, 4)).toBeVisible();
  // Stretch has no run, and shows no flame at all rather than "0".
  await expect(page.getByLabel(/in a row$/)).toHaveCount(1);
});

test('V2A-24 · ⭐ an unfinished today does not zero the streak', async ({ page }) => {
  await page.clock.setFixedTime(new Date('2026-09-16T12:00:00+08:00'));
  await seed(page, WEEK);
  await openApp(page);

  await habitRow(page, 'Drink water').click(); // untick today
  await expect(habitRow(page, 'Drink water')).not.toBeChecked();
  await expect(streakBadge(page, 3)).toBeVisible();
});

test('V2A-25 · ⭐ at midnight the strip moves on and the streak survives', async ({ page }) => {
  // Previously a manual check: move the OS clock past midnight and come back.
  await page.clock.install({ time: new Date('2026-09-16T23:59:30+08:00') });
  await seed(page, WEEK);
  await openApp(page);

  await expect(habitRow(page, 'Drink water')).toBeChecked();
  await expect(todayDot(page, 'Drink water')).toHaveAccessibleName(/September 16 \(today\), done/);

  await page.clock.runFor(60_000); // to 00:00:30 on the 17th

  await expect(todayDot(page, 'Drink water')).toHaveAccessibleName(/Thursday, September 17 \(today\), not done/);
  await expect(habitRow(page, 'Drink water')).not.toBeChecked();
  await expect(streakBadge(page, 4)).toBeVisible();
});

test('V2A-26 · a phone that slept through midnight catches up when it wakes', async ({ page }) => {
  // No timer fires while a phone sleeps; the tab becoming visible is what
  // actually catches the rollover. Simulated by jumping the clock without
  // running timers, then firing visibilitychange.
  await page.clock.install({ time: new Date('2026-09-16T22:00:00+08:00') });
  await seed(page, WEEK);
  await openApp(page);

  await page.clock.setSystemTime(new Date('2026-09-17T07:00:00+08:00'));
  await page.evaluate(() => document.dispatchEvent(new Event('visibilitychange')));

  await expect(todayDot(page, 'Drink water')).toHaveAccessibleName(/September 17 \(today\), not done/);
  await expect(streakBadge(page, 4)).toBeVisible();
});

test('V2A-27 · filling in a past day sticks, extends the streak, and leaves today\'s badge alone', async ({ page }) => {
  await page.clock.setFixedTime(new Date('2026-09-16T12:00:00+08:00'));
  await seed(page, WEEK);
  await openApp(page);

  await expect(page.getByText('1/2', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: /^Drink water — Saturday, September 12, not done$/ }).click();

  await expect(streakBadge(page, 5)).toBeVisible();
  // Backfilling a past day must not claim anything was done today.
  await expect(page.getByText('1/2', { exact: true })).toBeVisible();

  await page.reload();
  await expect(page.getByRole('button', { name: /^Drink water — Saturday, September 12, done$/ })).toBeVisible();
});

test('V2A-28 · the big circle and today\'s dot always agree', async ({ page }) => {
  await page.clock.setFixedTime(new Date('2026-09-16T12:00:00+08:00'));
  await seed(page, WEEK);
  await openApp(page);

  await habitRow(page, 'Stretch').click();
  await expect(todayDot(page, 'Stretch')).toHaveAccessibleName(/\(today\), done$/);

  await todayDot(page, 'Stretch').click();
  await expect(habitRow(page, 'Stretch')).not.toBeChecked();
});
