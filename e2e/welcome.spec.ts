import { expect, test, type Page } from '@playwright/test';
import { testEmail } from '../test-support/local-supabase';
import { accountHabitTitles, expectSynced, signIn, supabase } from './account-helpers';
import { addHabit, goTo, habitRow, openApp, storedState } from './helpers';

/*
 * v5 Block C: Habibit never opens empty.
 *
 * A first-time visitor sees what the app is and can, in one tap, see it with
 * a believable couple of months — and the way back out is as close as the way
 * in. The sample never reaches an account: signing in clears it (your choice
 * at the start of the block), proved here against a real local Supabase.
 */

const SAMPLE_TITLES = ['Drink water', 'Morning run', 'Read 20 pages', 'Gym', 'Sleep by 11', 'Meditate'];
const banner = (page: Page) => page.getByRole('complementary', { name: 'Sample habits' });
const loadSample = (page: Page) => page.getByRole('button', { name: 'See it with sample habits' }).click();

test('V5C-60 · ⭐ a first visit opens on a welcome, not an empty list', async ({ page }) => {
  await openApp(page);
  await expect(page.getByRole('heading', { name: 'Small habits, kept daily.' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'See it with sample habits' })).toBeVisible();
  await expect(page.getByText('No habits yet')).toHaveCount(0);
});

test('V5C-61 · ⭐ one tap fills Today and Progress, and it survives a reload', async ({ page }) => {
  await openApp(page);
  await loadSample(page);

  for (const title of SAMPLE_TITLES) await expect(habitRow(page, title)).toBeVisible();
  await expect(banner(page)).toBeVisible();
  // The welcome has gone; the list is the list.
  await expect(page.getByRole('heading', { name: 'Small habits, kept daily.' })).toHaveCount(0);

  await goTo(page, 'Progress');
  const tiles = page.getByRole('region', { name: 'Highlights' });
  await expect(tiles).toContainText('Drink water');
  await expect(tiles).toContainText('Read 20 pages');
  await page.getByRole('button', { name: 'Year', exact: true }).click();
  await expect(page.locator('[data-day-state="done"]').first()).toBeVisible();

  await page.reload();
  await goTo(page, 'Today');
  await expect(habitRow(page, 'Drink water')).toBeVisible();
  await expect(banner(page)).toBeVisible();
});

test('V5C-62 · ⭐ clearing the sample brings the welcome back, and Undo undoes it', async ({ page }) => {
  await openApp(page);
  await loadSample(page);

  await banner(page).getByRole('button', { name: 'Clear them' }).click();
  await expect(page.getByRole('heading', { name: 'Small habits, kept daily.' })).toBeVisible();
  expect((await storedState(page)).state.habits).toEqual([]);

  await page.getByRole('button', { name: 'Undo' }).click();
  await expect(habitRow(page, 'Drink water')).toBeVisible();
});

test('V5C-63 · ⭐ clearing keeps a habit you added yourself', async ({ page }) => {
  await openApp(page);
  await loadSample(page);
  await addHabit(page, 'My own habit');

  await banner(page).getByRole('button', { name: 'Clear them' }).click();

  await expect(habitRow(page, 'My own habit')).toBeVisible();
  for (const title of SAMPLE_TITLES) await expect(habitRow(page, title)).toHaveCount(0);
});

test('V5C-64 · a starter adds that habit, with a face, and the welcome steps aside', async ({ page }) => {
  await openApp(page);
  await page.getByRole('button', { name: 'Add Meditate' }).click();

  await expect(habitRow(page, 'Meditate')).toBeVisible();
  await expect(habitRow(page, 'Meditate').locator('svg.lucide-brain')).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Small habits, kept daily.' })).toHaveCount(0);
  await expect(banner(page)).toHaveCount(0);
});

test.describe('on the smallest supported phone', () => {
  test.use({ viewport: { width: 375, height: 667 } });

  test('V5C-65 · the welcome fits, with no sideways scroll, and every button is a comfortable tap', async ({ page }) => {
    await openApp(page);
    expect(await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth)).toBe(false);
    // The starters by name: a pattern like /^Add / also catches the boxes' own
    // "Add habit" and "Add task" buttons (it counted 9, not 7, the first time).
    const starters = ['Drink water', 'Read', 'Walk', 'Meditate', 'Stretch', 'Sleep early'];
    const buttons = [
      page.getByRole('button', { name: 'See it with sample habits' }),
      ...starters.map((title) => page.getByRole('button', { name: `Add ${title}`, exact: true })),
    ];
    for (const button of buttons) {
      const box = await button.boundingBox();
      expect(box!.height).toBeGreaterThanOrEqual(44);
    }
  });
});

test.describe('with an account', () => {
  test.skip(!supabase, 'Needs local Supabase: start Docker, then `npm run db:start`.');

  test('V5C-66 · ⭐ signing in clears the sample, and the account never holds any of it', async ({ page }) => {
    // More steps than any other account test — load, add, a real sign-in, a
    // sync and a server check — so it gets the longer budget; no check is looser.
    test.slow();
    await openApp(page);
    await loadSample(page);
    await addHabit(page, 'My own habit');

    // Said before it happens.
    await page.getByRole('button', { name: /^Account:/ }).click();
    await expect(page.getByText('Signing in clears the sample habits. Anything you added yourself stays.')).toBeVisible();

    const userId = await signIn(page, testEmail('sample-sign-in'));

    await expect(habitRow(page, 'My own habit')).toBeVisible();
    for (const title of SAMPLE_TITLES) await expect(habitRow(page, title)).toHaveCount(0);
    await expect(banner(page)).toHaveCount(0);
    // Wait for the first sync the way every account spec does (live-sync.spec.ts):
    // on a loaded machine it takes longer than the default five seconds.
    await expectSynced(page);
    await expect.poll(() => accountHabitTitles(userId), { timeout: 10_000 }).toEqual(['My own habit']);
  });

  test('V5C-67 · signed in, an empty app does not offer the sample', async ({ page }) => {
    await openApp(page);
    await signIn(page, testEmail('sample-offer'));
    await expect(page.getByRole('heading', { name: 'Small habits, kept daily.' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'See it with sample habits' })).toHaveCount(0);
  });
});
