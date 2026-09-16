import { expect, test } from '@playwright/test';
import { addHabit, addTask, envelope, habitRow, moreActions, openApp, seed, streakBadge } from './helpers';

/*
 * Ported from docs/qa/v1-b-rename.md, plus the v0.5 cancel-delete bug.
 *
 * The row has shipped one blur-before-click bug already. Several of these are
 * about focus, which a real browser handles differently from jsdom — the v1
 * row B-15 ("tapping away saves") could not be exercised with real focus at
 * the time. Here it is.
 */

test.describe('the ⋯ menu', () => {
  test.beforeEach(async ({ page }) => {
    await openApp(page);
    await addHabit(page, 'Drink water');
  });

  test('V2A-10 · ⭐ tapping the row while the menu is open closes it without ticking', async ({ page }) => {
    await moreActions(page, 'Drink water').click();
    await expect(page.getByRole('button', { name: /^Delete Drink water/ })).toBeVisible();

    await habitRow(page, 'Drink water').click();

    await expect(page.getByRole('button', { name: /^Delete Drink water/ })).toBeHidden();
    await expect(habitRow(page, 'Drink water')).not.toBeChecked();
  });

  test('V2A-11 · delete takes two taps and stays deleted after a reload', async ({ page }) => {
    await moreActions(page, 'Drink water').click();
    await page.getByRole('button', { name: /^Delete Drink water/ }).click();

    await expect(habitRow(page, 'Drink water')).toBeHidden();
    await page.reload();
    await expect(page.getByText('No habits yet')).toBeVisible();
  });

  test('V2A-12 · the menu closes on its own after about four seconds', async ({ page }) => {
    await page.clock.install();
    await moreActions(page, 'Drink water').click();
    await expect(page.getByRole('button', { name: 'Rename habit: Drink water' })).toBeVisible();

    await page.clock.runFor(3_500);
    await expect(page.getByRole('button', { name: 'Rename habit: Drink water' })).toBeVisible();

    await page.clock.runFor(1_000);
    await expect(page.getByRole('button', { name: 'Rename habit: Drink water' })).toBeHidden();
    await expect(moreActions(page, 'Drink water')).toBeVisible();
  });
});

test.describe('renaming', () => {
  async function startRename(page: import('@playwright/test').Page, title: string) {
    await moreActions(page, title).click();
    await page.getByRole('button', { name: `Rename habit: ${title}` }).click();
    const input = page.getByRole('textbox', { name: `Rename habit: ${title}` });
    await expect(input).toBeFocused();
    return input;
  }

  test.beforeEach(async ({ page }) => {
    await openApp(page);
    await addHabit(page, 'Drink watr');
  });

  test('V2A-13 · the editor opens with the old name selected, so typing replaces it', async ({ page }) => {
    const input = await startRename(page, 'Drink watr');
    await page.keyboard.type('Drink water');
    await expect(input).toHaveValue('Drink water');
  });

  test('V2A-14 · Enter saves, and the new name survives a reload', async ({ page }) => {
    const input = await startRename(page, 'Drink watr');
    await input.fill('Drink water');
    await input.press('Enter');

    await expect(habitRow(page, 'Drink water')).toBeVisible();
    await page.reload();
    await expect(habitRow(page, 'Drink water')).toBeVisible();
  });

  test('V2A-15 · the ✓ button saves', async ({ page }) => {
    const input = await startRename(page, 'Drink watr');
    await input.fill('Drink water');
    await page.getByRole('button', { name: 'Save name' }).click();
    await expect(habitRow(page, 'Drink water')).toBeVisible();
  });

  test('V2A-16 · ⭐ tapping somewhere else saves (v1 row B-15, now with real focus)', async ({ page }) => {
    const input = await startRename(page, 'Drink watr');
    await input.fill('Drink water');

    await page.getByRole('heading', { name: 'Habibit' }).click();

    await expect(input).toBeHidden();
    await expect(habitRow(page, 'Drink water')).toBeVisible();
  });

  test('V2A-17 · Escape cancels and keeps the old name', async ({ page }) => {
    const input = await startRename(page, 'Drink watr');
    await input.fill('Something else');
    await input.press('Escape');

    await expect(habitRow(page, 'Drink watr')).toBeVisible();
    await expect(habitRow(page, 'Something else')).toBeHidden();
  });

  test('V2A-18 · cancelling one rename does not swallow the tap-away save of the next', async ({ page }) => {
    // The leftover-flag bug caught in v1 Block B.
    const first = await startRename(page, 'Drink watr');
    await first.press('Escape');

    const second = await startRename(page, 'Drink watr');
    await second.fill('Drink water');
    await page.getByRole('heading', { name: 'Habibit' }).click();

    await expect(habitRow(page, 'Drink water')).toBeVisible();
  });

  test('V2A-19 · a blank name is rejected and the habit is not deleted', async ({ page }) => {
    const input = await startRename(page, 'Drink watr');
    await input.fill('   ');
    await input.press('Enter');
    await expect(habitRow(page, 'Drink watr')).toBeVisible();
  });
});

test('V2A-20 · ⭐ renaming a habit keeps its streak and its filled dots', async ({ page }) => {
  await page.clock.setFixedTime(new Date('2026-09-16T12:00:00+08:00'));
  await seed(
    page,
    envelope({
      habits: [{ id: 'h1', title: 'Drink watr' }],
      completions: [
        ['h1', '2026-09-14'],
        ['h1', '2026-09-15'],
        ['h1', '2026-09-16'],
      ],
    }),
  );
  await openApp(page);
  await expect(streakBadge(page, 3)).toBeVisible();

  await moreActions(page, 'Drink watr').click();
  await page.getByRole('button', { name: 'Rename habit: Drink watr' }).click();
  await page.getByRole('textbox', { name: 'Rename habit: Drink watr' }).fill('Drink water');
  await page.keyboard.press('Enter');

  await expect(habitRow(page, 'Drink water')).toBeChecked();
  await expect(streakBadge(page, 3)).toBeVisible();
  await expect(page.getByRole('button', { name: /^Drink water — .*, done$/ })).toHaveCount(3);
});

test('V2A-21 · a done task stays done after being renamed', async ({ page }) => {
  await openApp(page);
  await addTask(page, 'Call mum');
  await page.getByRole('checkbox', { name: 'Call mum', exact: true }).click();

  await moreActions(page, 'Call mum').click();
  await page.getByRole('button', { name: 'Rename task: Call mum' }).click();
  await page.getByRole('textbox', { name: 'Rename task: Call mum' }).fill('Call mom');
  await page.keyboard.press('Enter');

  await expect(page.getByRole('checkbox', { name: 'Call mom', exact: true })).toBeChecked();
});
