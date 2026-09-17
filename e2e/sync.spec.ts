import { expect, test, type Page } from '@playwright/test';
import { testEmail } from '../test-support/local-supabase';
import { accountHabitTitles, admin, expectSynced, newDevice, openAccount, seedAccount, signIn, supabase } from './account-helpers';
import { addHabit, habitRow, moreActions, openApp, STORAGE_KEY } from './helpers';

/*
 * v2 Block D: the first sign-in, and keeping devices combined, end to end.
 *
 * Each "device" is a separate browser context: its own storage, its own
 * sign-in. The account is the local Supabase in Docker.
 */

test.skip(!supabase, 'Needs local Supabase: start Docker, then `npm run db:start`.');

test('V2D-50 · ⭐ habits already on the device survive signing in, and are uploaded to the account', async ({ page }) => {
  const email = testEmail('upload');
  await openApp(page);
  await addHabit(page, 'Drink water');
  await habitRow(page, 'Drink water').click();

  const userId = await signIn(page, email);
  await expectSynced(page);

  await expect(habitRow(page, 'Drink water')).toBeChecked();
  expect(await accountHabitTitles(userId)).toEqual(['Drink water']);
});

test('V2D-51 · signing in on an empty device brings the account’s habits onto it', async ({ page }) => {
  const email = testEmail('download');
  await seedAccount(email, ['Meditate', 'Stretch']);
  await openApp(page);

  await signIn(page, email);

  await expect(habitRow(page, 'Meditate')).toBeVisible();
  await expect(habitRow(page, 'Stretch')).toBeVisible();
});

test('V2D-52 · both have habits → both are kept, including two made separately with the same name', async ({ page }) => {
  const email = testEmail('both');
  await seedAccount(email, ['Drink water', 'Read']);
  await openApp(page);
  await addHabit(page, 'Drink water');
  await addHabit(page, 'Walk');

  const userId = await signIn(page, email);
  await expectSynced(page);

  await expect(habitRow(page, 'Drink water')).toHaveCount(2);
  await expect(habitRow(page, 'Read')).toBeVisible();
  await expect(habitRow(page, 'Walk')).toBeVisible();
  expect(await accountHabitTitles(userId)).toEqual(['Drink water', 'Drink water', 'Read', 'Walk']);
});

test('V2D-53 · ⭐ a second device signing in to the same account gets the first device’s habits and ticks', async ({ page, browser }) => {
  const email = testEmail('two-devices');
  await openApp(page);
  await addHabit(page, 'Drink water');
  await habitRow(page, 'Drink water').click();
  await signIn(page, email);
  await expectSynced(page);

  const pc = await newDevice(browser);
  await signIn(pc.page, email);

  await expect(habitRow(pc.page, 'Drink water')).toBeChecked();
  await pc.context.close();
});

test('V2D-54 · changes made after signing in reach the other device the next time each app opens', async ({ page, browser }) => {
  const email = testEmail('later');
  await openApp(page);
  await signIn(page, email);
  const pc = await newDevice(browser);
  await signIn(pc.page, email);

  // Both devices are already signed in. The phone adds a habit...
  await addHabit(page, 'Added on phone');
  await page.reload(); // "opening the app again" syncs
  await expectSynced(page);

  await pc.page.reload();
  await expect(habitRow(pc.page, 'Added on phone')).toBeVisible();

  // ...and the PC deletes it, which has to reach the phone as a tombstone.
  await moreActions(pc.page, 'Added on phone').click();
  await pc.page.getByRole('button', { name: /^Delete Added on phone/ }).click();
  await pc.page.reload();
  await expectSynced(pc.page);

  await page.reload();
  await expectSynced(page);
  await expect(habitRow(page, 'Added on phone')).toHaveCount(0);
  await pc.context.close();
});

test('V2D-55 · ⭐ signing out clears the device, and signing back in brings everything back', async ({ page }) => {
  const email = testEmail('signout');
  await openApp(page);
  await addHabit(page, 'Drink water');
  await signIn(page, email);
  await expectSynced(page);

  await openAccount(page);
  await page.getByRole('button', { name: 'Sign out', exact: true }).click();
  await expect(page.getByText('Signing out removes your habits from this device')).toBeVisible();
  await page.getByRole('button', { name: 'Sign out and clear this device' }).click();

  await expect(page.getByRole('button', { name: 'Account: sign in to sync' })).toBeVisible();
  await expect(page.getByText('No habits yet')).toBeVisible();
  await page.reload();
  await expect(page.getByText('No habits yet')).toBeVisible();
  const stored = await page.evaluate((key) => JSON.parse(localStorage.getItem(key)!), STORAGE_KEY);
  expect(stored.state.habits).toEqual([]);

  await signIn(page, email);
  await expect(habitRow(page, 'Drink water')).toBeVisible();
});

test('V2D-56 · cancelling sign-out keeps everything', async ({ page }) => {
  const email = testEmail('cancel');
  await openApp(page);
  await addHabit(page, 'Drink water');
  await signIn(page, email);

  await openAccount(page);
  await page.getByRole('button', { name: 'Sign out', exact: true }).click();
  // exact: the account button's label contains the test email, which contains "cancel".
  await page.getByRole('button', { name: 'Cancel', exact: true }).click();

  await expect(page.getByRole('button', { name: `Account: signed in as ${email}` })).toBeVisible();
  await expect(habitRow(page, 'Drink water')).toBeVisible();
});

test.describe('when the account can’t be reached', () => {
  const blockAccount = (page: Page) => page.route('**/rest/v1/**', (route) => route.abort('internetdisconnected'));

  test('V2D-57 · ⭐ a failed sync at sign-in leaves the device untouched, says so, and retrying works', async ({ page }) => {
    const email = testEmail('offline-signin');
    await openApp(page);
    await addHabit(page, 'Drink water');
    await blockAccount(page);

    const { data } = await admin().auth.admin.generateLink({ type: 'magiclink', email });
    await page.goto(`/auth/confirm?token_hash=${data.properties!.hashed_token}&type=email`);
    await expect(page.getByRole('button', { name: `Account: signed in as ${email}` })).toBeVisible();

    await openAccount(page);
    // Supabase retries a failed read three times (1s, 2s, 4s) before giving up, so allow for that.
    await expect(page.getByRole('alert').filter({ hasText: 'Couldn’t reach your account' })).toBeVisible({ timeout: 20_000 });
    await expect(habitRow(page, 'Drink water')).toBeVisible();
    expect(await accountHabitTitles(data.user!.id)).toEqual([]);

    await page.unroute('**/rest/v1/**');
    await page.getByRole('button', { name: 'Try again' }).click();
    await expect(page.getByRole('status').filter({ hasText: 'Synced' })).toBeVisible({ timeout: 15_000 });
    expect(await accountHabitTitles(data.user!.id)).toEqual(['Drink water']);
  });

  test('V2D-58 · ⭐ signing out while unreachable warns first, and staying signed in keeps everything', async ({ page }) => {
    const email = testEmail('offline-signout');
    await openApp(page);
    await signIn(page, email);
    await expectSynced(page);
    await addHabit(page, 'Not uploaded yet');
    await blockAccount(page);

    await openAccount(page);
    await page.getByRole('button', { name: 'Sign out', exact: true }).click();
    await page.getByRole('button', { name: 'Sign out and clear this device' }).click();

    await expect(page.getByRole('alert').filter({ hasText: 'would lose them' })).toBeVisible({ timeout: 15_000 });
    await page.getByRole('button', { name: 'Stay signed in' }).click();

    await expect(page.getByRole('button', { name: `Account: signed in as ${email}` })).toBeVisible();
    await expect(habitRow(page, 'Not uploaded yet')).toBeVisible();
  });
});
