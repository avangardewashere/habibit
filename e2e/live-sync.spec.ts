import { expect, test, type Page } from '@playwright/test';
import { testEmail } from '../test-support/local-supabase';
import { accountHabitTitles, expectSynced, newDevice, openAccount, signIn, supabase } from './account-helpers';
import { addHabit, habitRow, openApp } from './helpers';

/*
 * v2 Block E: two devices both open, staying in step without reloading.
 *
 * Each device is its own browser context, signed in to the same local account.
 * Where a test needs "30 seconds later", it moves that page's clock forward
 * instead of really waiting.
 */

test.skip(!supabase, 'Needs local Supabase: start Docker, then `npm run db:start`.');

const accountButton = (page: Page) => page.getByRole('button', { name: /^Account:/ });

test('V2E-50 · ⭐ an edit reaches the account within seconds, with no reload', async ({ page }) => {
  const email = testEmail('live-up');
  await openApp(page);
  const userId = await signIn(page, email);
  await expectSynced(page);

  await addHabit(page, 'Drink water');

  await expect.poll(() => accountHabitTitles(userId), { timeout: 10_000 }).toEqual(['Drink water']);
});

test('V2E-51 · ⭐ with both devices open, the PC shows a phone edit within 30 seconds, with no reload', async ({ page, browser }) => {
  const email = testEmail('live-down');
  await openApp(page);
  const userId = await signIn(page, email);

  const pc = await newDevice(browser);
  await pc.page.clock.install();
  await signIn(pc.page, email);
  await expectSynced(pc.page);

  await addHabit(page, 'Added on phone');
  await expect.poll(() => accountHabitTitles(userId), { timeout: 10_000 }).toContain('Added on phone');

  await expect(habitRow(pc.page, 'Added on phone')).toHaveCount(0);
  await pc.page.clock.runFor(31_000); // the PC's 30-second check comes round

  await expect(habitRow(pc.page, 'Added on phone')).toBeVisible({ timeout: 10_000 });
  await pc.context.close();
});

test('V2E-52 · switching back to the app checks for changes straight away', async ({ page, browser }) => {
  const email = testEmail('live-focus');
  await openApp(page);
  const userId = await signIn(page, email);

  const pc = await newDevice(browser);
  await signIn(pc.page, email);
  await expectSynced(pc.page);

  await addHabit(page, 'Ticked on phone');
  await habitRow(page, 'Ticked on phone').click();
  await expect.poll(() => accountHabitTitles(userId), { timeout: 10_000 }).toContain('Ticked on phone');

  // The PC tab comes back into view.
  await pc.page.evaluate(() => document.dispatchEvent(new Event('visibilitychange')));

  await expect(habitRow(pc.page, 'Ticked on phone')).toBeChecked({ timeout: 10_000 });
  await pc.context.close();
});

test('V2E-53 · ⭐ the account button shows a dot while an edit is waiting, and it clears once uploaded', async ({ page }) => {
  const email = testEmail('live-dot');
  await openApp(page);
  await signIn(page, email);
  await expectSynced(page);

  await page.route('**/rest/v1/**', (route) => route.abort('internetdisconnected'));
  await addHabit(page, 'Made offline');

  // Screen readers get the same news the dot gives.
  await expect(accountButton(page)).toHaveAccessibleName(/1 change waiting to sync|Sync problem/, { timeout: 20_000 });
  await expect(page.locator('[data-sync-dot]')).toBeVisible();

  await page.unroute('**/rest/v1/**');
  await page.evaluate(() => document.dispatchEvent(new Event('visibilitychange')));

  await expect(page.locator('[data-sync-dot]')).toHaveCount(0, { timeout: 20_000 });
  await expect(accountButton(page)).toHaveAccessibleName(`Account: signed in as ${email}`);
});

test('V2E-54 · the popup says how many changes are waiting', async ({ page }) => {
  const email = testEmail('live-count');
  await openApp(page);
  await signIn(page, email);
  await expectSynced(page);

  await page.route('**/rest/v1/**', (route) => route.abort('internetdisconnected'));
  await addHabit(page, 'One');
  await addHabit(page, 'Two');

  await openAccount(page);
  await expect(page.getByRole('status').filter({ hasText: '2 changes waiting to sync' })).toBeVisible({ timeout: 20_000 });
});
