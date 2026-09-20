import { expect, test } from '@playwright/test';
import { openApp } from './helpers';

/*
 * v3 Block G: the privacy page in a real browser, against a real build.
 *
 * The unit tests check what it says. These check that someone can actually get
 * to it and back — which is a different thing, and the one that breaks when a
 * route is renamed.
 */

test('V3G-20 · ⭐ reachable from the app, signed out, and gets you back', async ({ page }) => {
  await openApp(page);

  await page.getByRole('link', { name: 'Privacy' }).click();

  await expect(page).toHaveURL(/\/privacy$/);
  await expect(page.getByRole('heading', { name: 'Privacy', level: 1 })).toBeVisible();

  await page.getByRole('link', { name: 'Back to Habibit' }).click();
  await expect(page.getByRole('heading', { name: 'Habibit' })).toBeVisible();
});

test('V3G-21 · ⭐ it opens on its own, without visiting the app first', async ({ page }) => {
  // Someone sent a link. It has to work cold, with nothing in storage.
  const response = await page.goto('/privacy');

  expect(response?.status()).toBe(200);
  await expect(page.getByRole('heading', { name: 'Privacy', level: 1 })).toBeVisible();
  await expect(page.getByText(/everything stays in this browser/i)).toBeVisible();
});

test('V3G-22 · the link is comfortable to tap on a phone', async ({ page }) => {
  await openApp(page);

  const box = await page.getByRole('link', { name: 'Privacy' }).boundingBox();

  expect(box!.height).toBeGreaterThanOrEqual(44);
});
