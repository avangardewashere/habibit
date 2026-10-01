import { expect, test, type Page } from '@playwright/test';
import { addHabit, habitRow, moreActions, openApp, storedState } from './helpers';

/*
 * v4 Block B: choosing how often a habit is due, in a real browser.
 *
 * The unit tests cover the rules. What only this can show is the whole path a
 * person takes — open the habit's menu, pick days, close the sheet, come back
 * tomorrow (a reload) and find the choice still there, written to storage in
 * the shape the app will still read in v5.
 */

const sheet = (page: Page) => page.getByRole('dialog');

async function openSchedule(page: Page, title: string) {
  await moreActions(page, title).click();
  await page.getByRole('button', { name: new RegExp(`^When ${title} is due`) }).click();
  await expect(sheet(page)).toBeVisible();
}

/** What is actually in storage for the first habit — the thing that syncs. */
async function storedSchedule(page: Page) {
  const stored = await storedState(page);
  return stored.state.habits[0].schedule ?? null;
}

test('V4B-50 · ⭐ choosing certain days sticks, and survives a reload', async ({ page }) => {
  await openApp(page);
  await addHabit(page, 'Run');

  await openSchedule(page, 'Run');
  await page.getByRole('radio', { name: /Certain days/ }).click();
  for (const day of ['Monday', 'Wednesday', 'Friday']) {
    const button = page.getByRole('button', { name: day, exact: true });
    if ((await button.getAttribute('aria-pressed')) === 'false') await button.click();
  }
  // Whatever today is, the day it started on may not be one of the three.
  for (const day of ['Tuesday', 'Thursday', 'Saturday', 'Sunday']) {
    const button = page.getByRole('button', { name: day, exact: true });
    if ((await button.getAttribute('aria-pressed')) === 'true') await button.click();
  }

  expect(await storedSchedule(page)).toBe('weekdays:0,2,4');

  await page.getByRole('button', { name: 'Close' }).click();
  await expect(sheet(page)).toHaveCount(0);

  await page.reload();
  await openSchedule(page, 'Run');
  await expect(sheet(page)).toContainText('Run — Mon, Wed and Fri');
  await expect(page.getByRole('radio', { name: /Certain days/ })).toBeChecked();
});

test('V4B-51 · ⭐ a few times a week sticks too', async ({ page }) => {
  await openApp(page);
  await addHabit(page, 'Gym');

  await openSchedule(page, 'Gym');
  await page.getByRole('radio', { name: /A few times a week/ }).click();
  await page.getByRole('button', { name: '4 times a week' }).click();

  expect(await storedSchedule(page)).toBe('weekly:4');

  await page.reload();
  await openSchedule(page, 'Gym');
  await expect(sheet(page)).toContainText('Gym — 4 times a week');
});

test('V4B-52 · ⭐ a habit can never end up due on no days at all', async ({ page }) => {
  await openApp(page);
  await addHabit(page, 'Read');

  await openSchedule(page, 'Read');
  await page.getByRole('radio', { name: /Certain days/ }).click();
  // Start from three days on, then turn every one of them off. The last must refuse.
  for (const day of ['Monday', 'Wednesday', 'Friday']) {
    const button = page.getByRole('button', { name: day, exact: true });
    if ((await button.getAttribute('aria-pressed')) === 'false') await button.click();
  }

  for (const day of ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']) {
    const button = page.getByRole('button', { name: day, exact: true });
    if ((await button.getAttribute('aria-pressed')) === 'true') await button.click();
  }

  const pressed = await page
    .getByRole('button', { name: /^(Mon|Tues|Wednes|Thurs|Fri|Satur|Sun)day$/ })
    .evaluateAll((buttons) => buttons.filter((b) => b.getAttribute('aria-pressed') === 'true').length);
  expect(pressed).toBe(1);
  expect(await storedSchedule(page)).toMatch(/^weekdays:[0-6]$/);
});

test('V4B-53 · ⭐ today’s list is unchanged by a schedule (that is Block C)', async ({ page }) => {
  await openApp(page);
  await addHabit(page, 'Swim');

  await openSchedule(page, 'Swim');
  await page.getByRole('radio', { name: /A few times a week/ }).click();
  await page.getByRole('button', { name: 'Close' }).click();

  // Still there, still tickable, whatever day it is: Block B only records the
  // choice. Nobody's list changes on the day this ships.
  await habitRow(page, 'Swim').click();
  await expect(habitRow(page, 'Swim')).toBeChecked();
});

test('V4B-54 · the sheet fits a phone, and every choice is a comfortable tap', async ({ page }) => {
  await openApp(page);
  await addHabit(page, 'A habit with quite a long name, long enough to wrap in the sheet');

  await openSchedule(page, 'A habit with quite a long name, long enough to wrap in the sheet');
  await page.getByRole('radio', { name: /Certain days/ }).click();

  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  expect(overflow).toBeLessThanOrEqual(0);

  for (const name of ['Monday', 'Sunday']) {
    const box = await page.getByRole('button', { name, exact: true }).boundingBox();
    expect(box!.height, name).toBeGreaterThanOrEqual(44);
    expect(box!.width, name).toBeGreaterThanOrEqual(40);
  }
});
