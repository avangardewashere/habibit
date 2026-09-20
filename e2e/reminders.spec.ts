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
 * A browser under automation is given nothing it hasn't asked for: Chromium
 * reports notifications as *denied* until the test grants them. That caught me
 * out — the first version of V3D-50 never asked, so it met the blocked message
 * and I read it as the section failing to render.
 *
 * Both states are real, so both are tested: allowed here, blocked in V3D-52.
 */
test.describe('with notifications allowed', () => {
  test.use({ permissions: ['notifications'] });

  test('V3D-50 · ⭐ signed in, the account popup offers a daily reminder, off to begin with', async ({ page }) => {
    await openApp(page);
    await signIn(page, testEmail('reminder-ui'));
    await openAccount(page);

    await expect(reminderSection(page)).toBeVisible();
    const turnOn = page.getByRole('button', { name: 'Turn on' });
    await expect(turnOn).toBeVisible();
    await expect(turnOn).toHaveAttribute('aria-pressed', 'false');
    await expect(page.getByText(/A nudge at 8:00 pm, only if something.s still unfinished/)).toBeVisible();
    // No time picker until it is on.
    await expect(page.getByRole('combobox')).toHaveCount(0);

    const box = await turnOn.boundingBox();
    expect(box!.height).toBeGreaterThanOrEqual(44);
  });
});

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
