import { expect, test, type Page } from '@playwright/test';
import { testEmail } from '../test-support/local-supabase';
import { accountHabitTitles, expectSynced, openAccount, signIn, supabase } from './account-helpers';
import { addHabit, envelope, habitRow, openApp, seed, THEME_KEY } from './helpers';

/*
 * v2 Block F: the app opens with no connection, and edits made there are not lost.
 *
 * These run against a production build, which is the only place the service
 * worker is registered — in development a cache would fight the dev server.
 */

const PLUM = 'rgb(36, 23, 38)'; // the dark theme's page colour

/**
 * Waits until the worker has kept everything this page would need to open again.
 *
 * Files fetched before the worker took over never passed through it, so the page
 * hands it the list; until that has finished, going offline would be testing the
 * wrong moment.
 */
async function offlineReady(page: Page) {
  await page.evaluate(async () => void (await navigator.serviceWorker.ready));
  await expect
    .poll(
      () =>
        page.evaluate(async () => {
          const wanted = performance
            .getEntriesByType('resource')
            .map((entry) => entry.name)
            .filter((name) => name.startsWith(`${location.origin}/_next/static/`));
          const kept = new Set<string>();
          for (const name of await caches.keys()) {
            const cache = await caches.open(name);
            for (const request of await cache.keys()) kept.add(request.url);
          }
          return wanted.length > 0 && wanted.every((url) => kept.has(url)) && kept.has(`${location.origin}/`);
        }),
      { timeout: 20_000 },
    )
    .toBe(true);
}

test('V2F-50 · ⭐ the app opens with no connection at all, with your habits', async ({ page, context }) => {
  await seed(page, envelope({ habits: [{ id: 'h1', title: 'Drink water' }] }));
  await openApp(page);
  await offlineReady(page);

  await context.setOffline(true);
  await page.reload();

  // Without the service worker this is the browser's "no internet" page.
  await expect(habitRow(page, 'Drink water')).toBeVisible();
  await context.setOffline(false);
});

test('V2F-51 · dark mode still arrives before the app does, with no connection', async ({ page, context }) => {
  await page.addInitScript((key) => localStorage.setItem(key, 'dark'), THEME_KEY);
  await openApp(page);
  await offlineReady(page);

  await context.setOffline(true);
  await page.reload();

  // The kept page carries the theme script inline, so there is still no white flash.
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  expect(await page.evaluate(() => getComputedStyle(document.body).backgroundColor)).toBe(PLUM);
  await context.setOffline(false);
});

test.describe('signed in', () => {
  test.skip(!supabase, 'Needs local Supabase: start Docker, then `npm run db:start`.');

  test('V2F-52 · ⭐ an edit made offline reaches the account as soon as the connection returns', async ({
    page,
    context,
  }) => {
    const email = testEmail('offline-edit');
    await openApp(page);
    const userId = await signIn(page, email);
    await expectSynced(page);
    await offlineReady(page);

    await context.setOffline(true);
    await addHabit(page, 'Made on a train');
    // The quiet dot, not the warning one: nothing is wrong.
    await expect(page.locator('[data-sync-dot="offline"]')).toBeVisible({ timeout: 25_000 });

    await context.setOffline(false);

    // No reload, and far sooner than the 30-second check: the connection returning is the signal.
    await expect.poll(() => accountHabitTitles(userId), { timeout: 20_000 }).toContain('Made on a train');
    await expect(page.locator('[data-sync-dot]')).toHaveCount(0, { timeout: 20_000 });
  });

  test('V2F-53 · the popup says you’re offline, and that nothing is lost', async ({ page, context }) => {
    const email = testEmail('offline-says');
    await openApp(page);
    await signIn(page, email);
    await expectSynced(page);
    await offlineReady(page);

    await context.setOffline(true);
    await addHabit(page, 'Made on a train');

    await openAccount(page);
    await expect(page.getByRole('status').filter({ hasText: 'You’re offline' })).toBeVisible({ timeout: 25_000 });
    await context.setOffline(false);
  });
});
