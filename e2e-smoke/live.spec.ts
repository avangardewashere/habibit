import { expect, test, type Page } from '@playwright/test';

/*
 * v3 Block G: does the deployed site actually work?
 *
 * Every other test in this repo runs against a build made moments earlier on a
 * machine we control. This one runs against whatever is really being served,
 * which catches a different class of thing entirely: a missing environment
 * variable, a broken deploy, a service worker that never registers over real
 * HTTPS, an icon that 404s.
 *
 * **Nothing here signs in or creates an account.** The live database has real
 * people in it. Everything below works signed out, and touches only this
 * browser's own storage.
 */

/** Opens the live app and waits for it to be interactive. */
async function openLive(page: Page) {
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Habibit' })).toBeVisible();
}

test('V3G-50 · ⭐ the site is served and the app renders', async ({ page }) => {
  const response = await page.goto('/');

  expect(response?.status()).toBe(200);
  await expect(page.getByRole('heading', { name: 'Habibit' })).toBeVisible();
  await expect(page.getByRole('textbox', { name: 'Add a habit...' })).toBeVisible();
});

test('V3G-51 · ⭐ a habit can be added and ticked on the real build', async ({ page }) => {
  await openLive(page);
  const title = `Smoke ${Date.now()}`;

  await page.getByRole('textbox', { name: 'Add a habit...' }).fill(title);
  await page.getByRole('button', { name: 'Add habit' }).click();

  const row = page.getByRole('checkbox', { name: title, exact: true });
  await expect(row).toBeVisible();
  await row.click();
  await expect(row).toBeChecked();

  // And it survives a reload, which is the whole point of the app.
  await page.reload();
  await expect(page.getByRole('checkbox', { name: title, exact: true })).toBeChecked();
});

test('V3G-52 · ⭐ the service worker registers on the real origin', async ({ page }) => {
  await openLive(page);

  const registered = await page.evaluate(async () => {
    const registration = await Promise.race([
      navigator.serviceWorker.ready,
      new Promise<null>((resolve) => setTimeout(() => resolve(null), 15_000)),
    ]);
    return Boolean(registration);
  });

  expect(registered, 'no service worker — the app will not open offline').toBe(true);
});

test('V3G-53 · ⭐ the app still opens with the network cut', async ({ page, context }) => {
  // The promise an installed app makes. Worth checking on the real origin,
  // because a service worker that fails to cache is invisible until you are
  // on a train.
  await openLive(page);
  await page.evaluate(() => navigator.serviceWorker.ready);
  await page.waitForTimeout(2_000); // let the worker finish its first caching

  await context.setOffline(true);
  await page.reload();

  await expect(page.getByRole('heading', { name: 'Habibit' })).toBeVisible();
  await context.setOffline(false);
});

test('V3G-54 · ⭐ it is installable: manifest and icons are really there', async ({ page, request }) => {
  await openLive(page);

  const href = await page.getAttribute('link[rel="manifest"]', 'href');
  expect(href, 'no manifest link').toBeTruthy();

  const manifest = await request.get(href!);
  expect(manifest.status()).toBe(200);
  const { name, icons, start_url } = await manifest.json();
  expect(name).toContain('Habibit');
  expect(start_url).toBeTruthy();
  expect(icons?.length ?? 0).toBeGreaterThan(0);

  // Every icon the manifest promises has to exist, or installing looks broken.
  for (const icon of icons) {
    const file = await request.get(new URL(icon.src, href!).toString());
    expect(file.status(), icon.src).toBe(200);
  }
});

test('V3G-55 · ⭐ the privacy page loads and is linked from the app', async ({ page }) => {
  await openLive(page);

  await page.getByRole('link', { name: 'Privacy' }).click();

  await expect(page.getByRole('heading', { name: 'Privacy', level: 1 })).toBeVisible();
  await expect(page.getByText(/everything stays in this browser/i)).toBeVisible();
  await page.getByRole('link', { name: 'Back to Habibit' }).click();
  await expect(page.getByRole('heading', { name: 'Habibit' })).toBeVisible();
});

test('V3G-56 · ⭐ accounts are switched on in the deployed build', async ({ page }) => {
  // The account button only exists when the Supabase settings reached the host.
  // Its absence on the live site means sync is quietly off for everyone.
  await openLive(page);

  await expect(page.getByRole('button', { name: /^Account:/ })).toBeVisible();
});

test('V3G-57 · the page does not report errors to the console', async ({ page }) => {
  const problems: string[] = [];
  page.on('console', (message) => {
    if (message.type() === 'error') problems.push(message.text());
  });
  page.on('pageerror', (error) => problems.push(String(error)));

  await openLive(page);
  await page.waitForTimeout(2_000);

  expect(problems).toEqual([]);
});
