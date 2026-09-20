import { expect, test } from '@playwright/test';
import { testEmail } from '../test-support/local-supabase';
import { admin, openAccount, seedAccount, signIn, supabase } from './account-helpers';
import { openApp } from './helpers';

/*
 * v3 Block F: leaving, in a real browser against a real database.
 *
 * The unit tests cover the wording and the database tests cover the cascades.
 * What only this can show is the join between them: that tapping the button
 * really does empty the account, and that the habits on the device really do
 * survive it — which is the promise the screen makes.
 */

test.skip(!supabase, 'Needs local Supabase: start Docker, then `npm run db:start`.');

test('V3F-50 · ⭐ deleting empties the account and leaves this device’s habits alone', async ({ page }) => {
  const email = testEmail('delete-flow');
  const userId = await seedAccount(email, ['Drink water', 'Stretch']);

  await openApp(page);
  await signIn(page, email);
  // The habits arrive from the account on the first sync.
  await expect(page.getByText('Drink water')).toBeVisible({ timeout: 15_000 });

  await openAccount(page);
  await page.getByRole('button', { name: 'Delete account' }).click();
  await expect(page.getByText(/Your habits stay on this device/)).toBeVisible();
  await page.getByRole('button', { name: 'Delete my account' }).click();

  // Signed out: the popup offers sign-in again.
  await expect(page.getByRole('textbox', { name: 'Email address' })).toBeVisible({ timeout: 15_000 });
  await page.keyboard.press('Escape');

  // The promise the screen made.
  await expect(page.getByText('Drink water')).toBeVisible();
  await expect(page.getByText('Stretch')).toBeVisible();

  // And the account really is gone, asked of the database directly.
  const { data } = await admin().auth.admin.getUserById(userId);
  expect(data?.user ?? null).toBeNull();
  const habits = await admin().from('habits').select('id').eq('user_id', userId);
  expect(habits.data ?? []).toEqual([]);
});

test('V3F-51 · ⭐ the habits survive a reload, so they are really on the device', async ({ page }) => {
  const email = testEmail('delete-reload');
  await seedAccount(email, ['Read a page']);

  await openApp(page);
  await signIn(page, email);
  await expect(page.getByText('Read a page')).toBeVisible({ timeout: 15_000 });

  await openAccount(page);
  await page.getByRole('button', { name: 'Delete account' }).click();
  await page.getByRole('button', { name: 'Delete my account' }).click();
  await expect(page.getByRole('textbox', { name: 'Email address' })).toBeVisible({ timeout: 15_000 });
  await page.keyboard.press('Escape');

  await page.reload();

  await expect(page.getByText('Read a page')).toBeVisible();
  // Still signed out after the reload, rather than a token that outlived its account.
  await expect(page.getByRole('button', { name: /^Account: signed in/ })).toHaveCount(0);
});

test('V3F-52 · ⭐ backing out changes nothing at all', async ({ page }) => {
  const email = testEmail('delete-cancel');
  const userId = await seedAccount(email, ['Walk']);

  await openApp(page);
  await signIn(page, email);
  await openAccount(page);

  await page.getByRole('button', { name: 'Delete account' }).click();
  await page.getByRole('button', { name: 'Keep my account' }).click();

  await expect(page.getByRole('button', { name: 'Sign out' })).toBeVisible();
  const { data } = await admin().auth.admin.getUserById(userId);
  expect(data?.user?.id).toBe(userId);
});
