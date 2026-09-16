import { expect, test } from '@playwright/test';
import { addHabit, addTask, CORRUPT_KEY, habitRow, openApp, STORAGE_KEY, storedState } from './helpers';

/*
 * Ported from docs/qa/v0.5-a-persistence.md.
 *
 * The headline bug of v0.5: reloading wiped everything. It only happened in a
 * real browser, which is why the unit tests alone did not catch it the first
 * time. These run the real app, reload it for real, and read the real storage.
 */

test('V2A-05 · habits, ticks and tasks survive a reload', async ({ page }) => {
  await openApp(page);
  await addHabit(page, 'Drink water');
  await addHabit(page, 'Stretch');
  await addTask(page, 'Call mum');
  await habitRow(page, 'Drink water').click();
  await expect(habitRow(page, 'Drink water')).toBeChecked();

  await page.reload();

  await expect(habitRow(page, 'Drink water')).toBeChecked();
  await expect(habitRow(page, 'Stretch')).not.toBeChecked();
  await expect(page.getByRole('checkbox', { name: 'Call mum', exact: true })).toBeVisible();
});

test('V2A-06 · ⭐ data survives six reloads in a row', async ({ page }) => {
  // The original bug did not always fire on the first reload. Six is what the
  // manual checklist asked for, so six it is.
  await openApp(page);
  await addHabit(page, 'Read 10 pages');
  await habitRow(page, 'Read 10 pages').click();

  for (let i = 0; i < 6; i++) {
    await page.reload();
    await expect(habitRow(page, 'Read 10 pages')).toBeChecked();
  }

  const stored = await storedState(page);
  expect(stored.version).toBe(2);
  expect(stored.state.habits).toHaveLength(1);
});

test('V2A-07 · data survives closing the tab and opening a new one', async ({ context, page }) => {
  await openApp(page);
  await addHabit(page, 'Meditate');
  await page.close();

  const fresh = await context.newPage();
  await openApp(fresh);
  await expect(habitRow(fresh, 'Meditate')).toBeVisible();
});

test('V2A-08 · a second open tab picks up changes from the first', async ({ context, page }) => {
  await openApp(page);
  const other = await context.newPage();
  await openApp(other);

  await addHabit(page, 'Walk');
  await expect(habitRow(other, 'Walk')).toBeVisible();

  // And back the other way, so neither tab's stale copy overwrites the other.
  await habitRow(other, 'Walk').click();
  await expect(habitRow(page, 'Walk')).toBeChecked();
});

test('V2A-09 · corrupt stored data is quarantined and the app still starts', async ({ page }) => {
  await openApp(page);
  await page.evaluate((key) => localStorage.setItem(key, '{not json'), STORAGE_KEY);

  await page.reload();

  await expect(page.getByText('No habits yet')).toBeVisible();
  const quarantined = await page.evaluate((key) => localStorage.getItem(key), CORRUPT_KEY);
  expect(quarantined).toBe('{not json');

  // And the app is usable again straight away.
  await addHabit(page, 'Start over');
  await page.reload();
  await expect(habitRow(page, 'Start over')).toBeVisible();
});
