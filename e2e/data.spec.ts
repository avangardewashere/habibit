import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { expect, test } from '@playwright/test';
import { addHabit, addTask, habitRow, moreActions, openApp, seedRaw, storedState, streakBadge } from './helpers';

/*
 * v2 Block B: sync-ready data, checked in a real browser against a production
 * build.
 *
 * The v1 data is the exact bytes captured from the live v1.0.0 app, so these
 * tests are what someone opening Habibit the day this ships will actually hit.
 */

const RAW_V1 = readFileSync(join(__dirname, '..', 'lib', 'fixtures', 'storage-v1.json'), 'utf8');
// The capture was made on this day, so "today" in the data is the 16th.
const CAPTURE_DAY = new Date('2026-09-16T12:00:00+08:00');

test.describe('a returning v1 user after the update', () => {
  test.beforeEach(async ({ page }) => {
    await page.clock.setFixedTime(CAPTURE_DAY);
    await seedRaw(page, RAW_V1);
  });

  test('V2B-01 · ⭐ sees every habit, tick, streak and task exactly as before', async ({ page }) => {
    await openApp(page);

    await expect(habitRow(page, 'Drink water')).toBeChecked();
    await expect(habitRow(page, 'Stretch')).not.toBeChecked();
    await expect(habitRow(page, 'Read 20 pages')).toBeChecked();
    await expect(page.getByText('2/3', { exact: true })).toBeVisible();

    // Drink water was filled in for the 13th to the 16th; Read 20 pages only today.
    await expect(streakBadge(page, 4)).toBeVisible();
    await expect(streakBadge(page, 1)).toBeVisible();
    await expect(page.getByRole('button', { name: /^Stretch — Monday, September 14, done$/ })).toBeVisible();
    // Stretch was ticked on the 15th and then unticked. In v1 that left no record.
    await expect(page.getByRole('button', { name: /^Stretch — Tuesday, September 15, not done$/ })).toBeVisible();

    await expect(page.getByRole('checkbox', { name: 'Call mum', exact: true })).toBeChecked();
    await expect(page.getByRole('checkbox', { name: 'Book dentist', exact: true })).not.toBeChecked();
    await expect(page.getByText('1 left', { exact: true })).toBeVisible();

    // The habit and task deleted before the capture stay gone.
    await expect(habitRow(page, 'Old habit')).toHaveCount(0);
    await expect(page.getByRole('checkbox', { name: 'Buy milk', exact: true })).toHaveCount(0);
  });

  test('V2B-02 · ⭐ just opening the app does not rewrite their data', async ({ page }) => {
    await openApp(page);
    await expect(habitRow(page, 'Drink water')).toBeChecked();
    await page.reload();
    await expect(habitRow(page, 'Drink water')).toBeChecked();

    const raw = await page.evaluate(() => localStorage.getItem('habibit:state'));
    expect(raw).toBe(RAW_V1);
  });

  test('V2B-03 · their first change saves everything as version 2, and it all survives a reload', async ({ page }) => {
    await openApp(page);
    await habitRow(page, 'Stretch').click();

    await expect.poll(async () => (await storedState(page)).version).toBe(2);
    await page.reload();

    await expect(habitRow(page, 'Stretch')).toBeChecked();
    await expect(habitRow(page, 'Drink water')).toBeChecked();
    await expect(streakBadge(page, 4)).toBeVisible();
    await expect(page.getByText('3/3', { exact: true })).toBeVisible();
    await expect(page.getByRole('checkbox', { name: 'Call mum', exact: true })).toBeChecked();

    const { state } = await storedState(page);
    expect(state.habits).toHaveLength(3);
    expect(state.tasks).toHaveLength(2);
    expect(Object.keys(state.completions)).toHaveLength(7);
  });
});

test.describe('what gets stored now', () => {
  test('V2B-04 · deleting a habit leaves a hidden tombstone, not a gap', async ({ page }) => {
    await openApp(page);
    await addHabit(page, 'Drink water');
    await habitRow(page, 'Drink water').click();

    await moreActions(page, 'Drink water').click();
    await page.getByRole('button', { name: /^Delete Drink water/ }).click();
    await page.reload();

    await expect(page.getByText('No habits yet')).toBeVisible();
    const { state } = await storedState(page);
    expect(state.habits).toHaveLength(1);
    expect(state.habits[0]).toMatchObject({ title: 'Drink water', deletedAt: expect.any(String) });
    expect(state.habits[0].updatedAt).toBe(state.habits[0].deletedAt);
  });

  test('V2B-05 · deleting a task leaves a hidden tombstone', async ({ page }) => {
    await openApp(page);
    await addTask(page, 'Buy milk');
    await moreActions(page, 'Buy milk').click();
    await page.getByRole('button', { name: 'Delete task: Buy milk' }).click();
    await page.reload();

    await expect(page.getByText('Nothing on the list')).toBeVisible();
    const { state } = await storedState(page);
    expect(state.tasks[0]).toMatchObject({ title: 'Buy milk', deletedAt: expect.any(String) });
  });

  test('V2B-06 · unticking is stored as done: false, so it can sync later', async ({ page }) => {
    await openApp(page);
    await addHabit(page, 'Stretch');
    await habitRow(page, 'Stretch').click();
    await habitRow(page, 'Stretch').click();
    await expect(habitRow(page, 'Stretch')).not.toBeChecked();

    const { state } = await storedState(page);
    const records = Object.values(state.completions);
    expect(records).toEqual([{ done: false, updatedAt: expect.any(String) }]);
  });

  test('V2B-07 · every change moves updatedAt forward', async ({ page }) => {
    await page.clock.install({ time: new Date('2026-09-16T09:00:00+08:00') });
    await openApp(page);
    await addHabit(page, 'Drink watr');
    const created = (await storedState(page)).state.habits[0];
    expect(created.updatedAt).toBe(created.createdAt);

    await page.clock.fastForward(60_000);
    await moreActions(page, 'Drink watr').click();
    await page.getByRole('button', { name: 'Rename habit: Drink watr' }).click();
    await page.getByRole('textbox', { name: 'Rename habit: Drink watr' }).fill('Drink water');
    await page.keyboard.press('Enter');
    await expect(habitRow(page, 'Drink water')).toBeVisible();

    const renamed = (await storedState(page)).state.habits[0];
    expect(renamed.createdAt).toBe(created.createdAt);
    expect(Date.parse(renamed.updatedAt)).toBeGreaterThan(Date.parse(created.updatedAt));
  });
});
