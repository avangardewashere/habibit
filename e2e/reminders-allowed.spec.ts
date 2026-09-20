import { expect, test } from '@playwright/test';
import { testEmail } from '../test-support/local-supabase';
import { openAccount, signIn, supabase } from './account-helpers';
import { openApp } from './helpers';

/*
 * v3 Block D: the reminder section as someone who has allowed notifications
 * sees it.
 *
 * Why this test is alone in its own file, on a different browser: Playwright's
 * default runner is Chromium's "headless shell", a stripped-down build with no
 * notification machinery in it at all. It reports notifications as *denied*
 * whatever the test asks for (microsoft/playwright#23954), so the allowed state
 * cannot be reached there. `channel: 'chromium'` runs the full browser, where
 * granting works — and a browser is chosen per file, which is why this is a
 * file rather than a `describe`.
 *
 * The other reminder tests stay on the default runner, where "denied" is the
 * state they want anyway.
 */
test.use({ channel: 'chromium', permissions: ['notifications'] });

test.skip(!supabase, 'Needs local Supabase: start Docker, then `npm run db:start`.');

test('V3D-50 · ⭐ signed in and allowed, the account popup offers a daily reminder, off to begin with', async ({
  page,
}) => {
  await openApp(page);
  await signIn(page, testEmail('reminder-ui'));
  await openAccount(page);

  // Longer than the default: the section waits for this browser's service
  // worker, and gives up after five seconds (lib/reminders/push.ts).
  await expect(page.getByText('Daily reminder')).toBeVisible({ timeout: 15_000 });
  const turnOn = page.getByRole('button', { name: 'Turn on' });
  await expect(turnOn).toBeVisible();
  await expect(turnOn).toHaveAttribute('aria-pressed', 'false');
  await expect(page.getByText(/A nudge at 8:00 pm, only if something.s still unfinished/)).toBeVisible();
  // No time picker until it is on.
  await expect(page.getByRole('combobox')).toHaveCount(0);

  const box = await turnOn.boundingBox();
  expect(box!.height).toBeGreaterThanOrEqual(44);
});
