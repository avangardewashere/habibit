import { expect, test, type Page } from '@playwright/test';
import { testEmail } from '../test-support/local-supabase';
import { signIn, supabase } from './account-helpers';
import { addHabit, moreActions, openApp } from './helpers';

/*
 * v4 Block E: turning on a reminder for one habit, in a real browser, against
 * a real database.
 *
 * On `channel: 'chromium'` for the same reason as v3's allowed-reminders test:
 * the default headless shell has no notification machinery and reports
 * permission as denied whatever the test asks for
 * (microsoft/playwright#23954). A browser is chosen per file, so this is a
 * file of its own.
 */
test.use({ channel: 'chromium', permissions: ['notifications'] });

test.skip(!supabase, 'Needs local Supabase: start Docker, then `npm run db:start`.');

/**
 * Stands in for the browser's push service.
 *
 * `pushManager.subscribe()` really does ask Google's push service for an
 * address, which a test machine cannot reach — so without this the switch can
 * never be turned on here, and the half of this block that matters (what
 * reaches the account) would go untested. Everything after the subscribe call
 * is the real thing: the real component, the real writes, the real database.
 */
async function stubPushService(page: Page) {
  await page.addInitScript(() => {
    const fake = {
      endpoint: 'https://push.example/e2e-device',
      toJSON: () => ({ endpoint: 'https://push.example/e2e-device', keys: { p256dh: 'p256dh-e2e', auth: 'auth-e2e' } }),
      unsubscribe: async () => true,
    };
    const patch = () => {
      if (!('PushManager' in window)) return;
      PushManager.prototype.subscribe = async () => fake as unknown as PushSubscription;
      PushManager.prototype.getSubscription = async () => null;
    };
    patch();
  });
}

test('V4E-50 · ⭐ a habit can be given its own reminder, private by default', async ({ page }) => {
  await stubPushService(page);
  await openApp(page);
  await signIn(page, testEmail('habit-reminder'));
  await addHabit(page, 'Take medication');

  await moreActions(page, 'Take medication').click();
  await page.getByRole('button', { name: /^When Take medication is due/ }).click();
  const sheet = page.getByRole('dialog');

  // Longer than the default: the section waits for this browser's service
  // worker, and gives up after five seconds (lib/reminders/push.ts).
  const turnOn = page.getByRole('button', { name: 'Remind me about Take medication' });
  await expect(turnOn).toBeVisible({ timeout: 15_000 });
  await expect(turnOn).toHaveAttribute('aria-pressed', 'false');
  await expect(sheet).toContainText('The daily one carries on either way');

  await turnOn.click();

  await expect(turnOn).toHaveAttribute('aria-pressed', 'true', { timeout: 15_000 });
  // v3's promise holds until you say otherwise, habit by habit.
  const naming = page.getByRole('button', { name: 'Say “Take medication” in the reminder' });
  await expect(naming).toHaveAttribute('aria-pressed', 'false');
  await expect(sheet).toContainText('only say Habibit — not which habit');

  await naming.click();
  await expect(sheet).toContainText('Your lock screen will show “Take medication”.');

  // It is really in the account, not just on screen: close the sheet, reopen it.
  await page.getByRole('button', { name: 'Close' }).click();
  await moreActions(page, 'Take medication').click();
  await page.getByRole('button', { name: /^When Take medication is due/ }).click();

  await expect(page.getByRole('button', { name: 'Remind me about Take medication' })).toHaveAttribute(
    'aria-pressed',
    'true',
    { timeout: 15_000 },
  );
  await expect(page.getByRole('button', { name: 'Say “Take medication” in the reminder' })).toHaveAttribute(
    'aria-pressed',
    'true',
  );
});

test('V4E-51 · ⭐ signed out, the sheet says reminders need an account rather than offering one', async ({ page }) => {
  await openApp(page);
  await addHabit(page, 'Stretch');

  await moreActions(page, 'Stretch').click();
  await page.getByRole('button', { name: /^When Stretch is due/ }).click();

  await expect(page.getByText(/Reminders need an account/)).toBeVisible();
  await expect(page.getByRole('button', { name: /^Remind me about/ })).toHaveCount(0);
  // The schedule half still works perfectly well without one.
  await expect(page.getByRole('radio', { name: /Every day/ })).toBeChecked();
});
