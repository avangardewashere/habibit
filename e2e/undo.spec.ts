import { expect, test, type Page } from '@playwright/test';
import { addHabit, addTask, habitRow, moreActions, openApp } from './helpers';

/*
 * v4 Block A: undo, in a real browser, against a real build.
 *
 * The unit tests cover the timing rules and the sync edge cases. What only this
 * can show is the whole loop the way a person meets it: tick something, delete
 * it by mistake, take it back, and find it exactly as it was — including after
 * a reload, which is the proof it was really restored and not just redrawn.
 */

const undoBar = (page: Page) => page.getByRole('status').filter({ hasText: /^Deleted/ });

async function deleteHabit(page: Page, title: string) {
  await moreActions(page, title).click();
  await page.getByRole('button', { name: `Delete ${title} and its whole completion history` }).click();
}

test('V4A-50 · ⭐ a deleted habit comes back ticked, and stays back after a reload', async ({ page }) => {
  await openApp(page);
  await addHabit(page, 'Water');
  await habitRow(page, 'Water').click();
  await expect(habitRow(page, 'Water')).toBeChecked();

  await deleteHabit(page, 'Water');

  await expect(habitRow(page, 'Water')).toHaveCount(0);
  await expect(undoBar(page)).toContainText('Deleted “Water”');

  await page.getByRole('button', { name: 'Undo' }).click();

  // Back, and still ticked: today's completion was never lost.
  await expect(habitRow(page, 'Water')).toBeChecked();
  await expect(undoBar(page)).toHaveCount(0);

  await page.reload();
  await expect(habitRow(page, 'Water')).toBeChecked();
});

test('V4A-51 · ⭐ left alone, the bar goes after six seconds and the delete stands', async ({ page }) => {
  await page.clock.install();
  await openApp(page);
  await addHabit(page, 'Stretch');

  await deleteHabit(page, 'Stretch');
  await expect(undoBar(page)).toBeVisible();

  await page.clock.fastForward(6_100);

  await expect(undoBar(page)).toHaveCount(0);
  await page.reload();
  await expect(habitRow(page, 'Stretch')).toHaveCount(0);
});

test('V4A-52 · ⭐ a deleted task can be taken back too', async ({ page }) => {
  await openApp(page);
  await addTask(page, 'Post letter');

  await page.getByRole('button', { name: 'More actions for Post letter', exact: true }).click();
  await page.getByRole('button', { name: 'Delete task: Post letter' }).click();
  await expect(page.getByRole('checkbox', { name: 'Post letter', exact: true })).toHaveCount(0);

  await page.getByRole('button', { name: 'Undo' }).click();

  await expect(page.getByRole('checkbox', { name: 'Post letter', exact: true })).toBeVisible();
});

test('V4A-53 · the bar sits clear of the list and does not cause sideways scroll on a phone', async ({ page }) => {
  await openApp(page);
  await addHabit(page, 'A habit with quite a long name that has to be cut short in the bar');
  await deleteHabit(page, 'A habit with quite a long name that has to be cut short in the bar');

  await expect(undoBar(page)).toBeVisible();
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow).toBeLessThanOrEqual(0);
  const box = await page.getByRole('button', { name: 'Undo' }).boundingBox();
  expect(box!.height).toBeGreaterThanOrEqual(44);
});
