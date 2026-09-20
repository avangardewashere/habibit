import { expect, test, type Page } from '@playwright/test';
import { testEmail } from '../test-support/local-supabase';
import { openAccount, signIn, supabase } from './account-helpers';
import { openApp } from './helpers';

/*
 * v3 Block D: turning the daily reminder on, in a real browser.
 *
 * What a real browser *cannot* do here: complete a push subscription. That needs
 * a push service (Google's, Mozilla's) and a key pair with a private half, which
 * this repo deliberately does not have. The registering itself is covered by
 * unit tests with the browser's push API stood in for, and finally by the phone
 * in your pocket.
 */

const reminderSection = (page: Page) => page.getByText('Daily reminder');

test.skip(!supabase, 'Needs local Supabase: start Docker, then `npm run db:start`.');

/*
 * Neither test here grants the notification permission, because neither wants
 * it: Playwright's default browser reports notifications as denied, which is
 * exactly the state V3D-52 is about. The allowed state needs a different
 * browser build and lives in reminders-allowed.spec.ts.
 */
test('V3D-52 · ⭐ a browser blocking notifications is told how to undo it, not offered a switch', async ({ page }) => {
  // No permission granted: exactly what someone who once tapped "Block" sees.
  await openApp(page);
  await signIn(page, testEmail('reminder-blocked'));
  await openAccount(page);

  await expect(page.getByText(/Notifications are blocked for Habibit/)).toBeVisible();
  await expect(page.getByRole('button', { name: 'Turn on' })).toHaveCount(0);
});

test('V3D-51 · ⭐ signed out, there is no reminder to set', async ({ page }) => {
  await openApp(page);
  await openAccount(page);

  await expect(page.getByRole('textbox', { name: 'Email address' })).toBeVisible();
  await expect(reminderSection(page)).toHaveCount(0);
});
