import { expect, test, type Page } from '@playwright/test';
import { testEmail } from '../test-support/local-supabase';
import { addHabit, habitRow, openApp, STORAGE_KEY } from './helpers';

/*
 * v2 Block C: signing in and out, end to end.
 *
 * Runs against the local Supabase in Docker. Emails are really sent, caught by
 * the local mail catcher, and read back here — so the code and link these tests
 * use are the ones a person would find in their inbox.
 */

const supabase = JSON.parse(process.env.HABIBIT_E2E_SUPABASE ?? 'null') as { mailUrl: string } | null;
test.skip(!supabase, 'Needs local Supabase: start Docker, then `npm run db:start`.');

type SignInEmail = { code: string; link: string };

/** Waits for the newest sign-in email to `email` and pulls out its code and link. */
async function readSignInEmail(email: string, olderThan?: SignInEmail): Promise<SignInEmail> {
  const base = supabase!.mailUrl;
  for (let attempt = 0; attempt < 40; attempt++) {
    const search = await fetch(`${base}/api/v1/search?query=${encodeURIComponent(`to:"${email}"`)}`);
    const { messages } = (await search.json()) as { messages?: { ID: string }[] };
    if (messages?.length) {
      const message = await (await fetch(`${base}/api/v1/message/${messages[0].ID}`)).json();
      const code = message.HTML.match(/data-testid="otp">\s*(\d+)/)?.[1];
      const link = message.HTML.match(/href="([^"]+)"/)?.[1]?.replaceAll('&amp;', '&');
      if (code && link && code !== olderThan?.code) return { code, link };
    }
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  throw new Error(`No sign-in email arrived for ${email}`);
}

// Next adds its own empty role="alert" (the route announcer), so alerts are always
// picked out by their text rather than by role alone.
const accountButton = (page: Page) => page.getByRole('button', { name: /^Account:/ });

async function openAccount(page: Page) {
  await accountButton(page).click();
  await expect(page.getByRole('dialog', { name: 'Account' })).toBeVisible();
}

/** Asks for a code and returns the email that arrived. Leaves the panel on the code step. */
async function requestCode(page: Page, email: string): Promise<SignInEmail> {
  await openAccount(page);
  await page.getByRole('textbox', { name: 'Email address' }).fill(email);
  await page.getByRole('button', { name: 'Email me a code' }).click();
  // Sending an email is slower than anything else the app does: seen taking over
  // 6s against local Supabase while the whole suite runs at once.
  await expect(page.getByRole('heading', { name: 'Check your email' })).toBeVisible({ timeout: 20_000 });
  return readSignInEmail(email);
}

async function expectSignedIn(page: Page, email: string) {
  await expect(page.getByRole('button', { name: `Account: signed in as ${email}` })).toBeVisible();
}

async function expectSignedOut(page: Page) {
  await expect(page.getByRole('button', { name: 'Account: sign in to sync' })).toBeVisible();
}

test('V2C-20 · the account button opens a sign-in form; Escape closes it and returns focus', async ({ page }) => {
  await openApp(page);
  await expectSignedOut(page);

  await openAccount(page);
  await expect(page.getByRole('textbox', { name: 'Email address' })).toBeFocused();
  await expect(page.getByRole('button', { name: 'Email me a code' })).toBeDisabled();

  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog', { name: 'Account' })).toBeHidden();
  await expect(accountButton(page)).toBeFocused();
});

test('V2C-21 · ⭐ signing in with the emailed code, and staying signed in after a reload', async ({ page }) => {
  const email = testEmail('code');
  await openApp(page);

  const { code } = await requestCode(page, email);
  await page.getByRole('textbox', { name: 'Sign-in code' }).fill(code);
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();

  await expect(page.getByText('Signed in as')).toBeVisible();
  await expect(page.getByText(email)).toBeVisible();
  await expectSignedIn(page, email);

  await page.reload();
  await expectSignedIn(page, email);
});

test('V2C-22 · signing in with the emailed link', async ({ page }) => {
  const email = testEmail('link');
  await openApp(page);
  const { link } = await requestCode(page, email);

  await page.goto(link);

  await expect(page).toHaveURL('/');
  await expectSignedIn(page, email);
});

test('V2C-23 · ⭐ the link works in a different browser from the one that asked for it', async ({ page, browser }) => {
  // The Android case: you ask in the installed app, but Gmail opens the link in Chrome.
  const email = testEmail('elsewhere');
  await openApp(page);
  const { link } = await requestCode(page, email);

  const otherBrowser = await browser.newContext();
  const other = await otherBrowser.newPage();
  await other.goto(link);

  await expect(other).toHaveURL('/');
  await expectSignedIn(other, email);
  await otherBrowser.close();
});

test('V2C-24 · a wrong code is refused with a clear message, and the right one still works', async ({ page }) => {
  const email = testEmail('wrong');
  await openApp(page);
  const { code } = await requestCode(page, email);
  const wrong = code === '000000' ? '111111' : '000000';

  await page.getByRole('textbox', { name: 'Sign-in code' }).fill(wrong);
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
  await expect(page.getByRole('alert').filter({ hasText: 'expired or was already used' })).toBeVisible();
  await expect(page.getByText('Signed in as')).toBeHidden();

  await page.getByRole('textbox', { name: 'Sign-in code' }).fill(code);
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
  await expectSignedIn(page, email);
});

test('V2C-25 · a link that was already used explains itself and leads back to the app', async ({ page, browser }) => {
  const email = testEmail('reused');
  await openApp(page);
  const { link } = await requestCode(page, email);
  await page.goto(link);
  await expectSignedIn(page, email);

  const otherBrowser = await browser.newContext();
  const other = await otherBrowser.newPage();
  await other.goto(link);

  await expect(other.getByRole('heading', { name: 'Couldn’t sign you in' })).toBeVisible();
  await expect(other.getByRole('alert').filter({ hasText: 'expired or was already used' })).toBeVisible();
  await other.getByRole('link', { name: 'Back to Habibit' }).click();
  await expect(other.getByRole('heading', { name: 'Habibit' })).toBeVisible();
  await expectSignedOut(other);
  await otherBrowser.close();
});

test('V2C-26 · a link with no token says so instead of spinning forever', async ({ page }) => {
  await page.goto('/auth/confirm');
  await expect(page.getByRole('alert').filter({ hasText: 'incomplete' })).toBeVisible();
});

test('V2C-27 · asking for a new code works, and only the newest code signs in', async ({ page }) => {
  const email = testEmail('resend');
  await openApp(page);
  const first = await requestCode(page, email);

  // Local Supabase allows a resend after 1s; the hosted default is 60s.
  await page.waitForTimeout(1_100);
  await page.getByRole('button', { name: 'Send a new code' }).click();
  await expect(page.getByRole('status')).toContainText('new code');
  const second = await readSignInEmail(email, first);

  // Asking again replaces the old code, so an old email can't be used later.
  await page.getByRole('textbox', { name: 'Sign-in code' }).fill(first.code);
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
  await expect(page.getByRole('alert').filter({ hasText: 'expired or was already used' })).toBeVisible();

  await page.getByRole('textbox', { name: 'Sign-in code' }).fill(second.code);
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
  await expectSignedIn(page, email);
});

test('V2C-28 · signing out, and staying signed out after a reload', async ({ page }) => {
  const email = testEmail('signout');
  await openApp(page);
  const { code } = await requestCode(page, email);
  await page.getByRole('textbox', { name: 'Sign-in code' }).fill(code);
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
  await expectSignedIn(page, email);

  await page.getByRole('button', { name: 'Sign out' }).click();
  await expectSignedOut(page);
  await page.reload();
  await expectSignedOut(page);
});

test('V2C-29 · ⭐ signing in and out leaves the habits on this device exactly as they were', async ({ page }) => {
  // There is no sync yet, so an account must neither copy, change nor clear local data.
  const email = testEmail('local');
  await openApp(page);
  await addHabit(page, 'Drink water');
  await habitRow(page, 'Drink water').click();
  const before = await page.evaluate((key) => localStorage.getItem(key), STORAGE_KEY);

  const { code } = await requestCode(page, email);
  await page.getByRole('textbox', { name: 'Sign-in code' }).fill(code);
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
  await expectSignedIn(page, email);
  expect(await page.evaluate((key) => localStorage.getItem(key), STORAGE_KEY)).toBe(before);

  await page.getByRole('button', { name: 'Sign out' }).click();
  await expectSignedOut(page);
  expect(await page.evaluate((key) => localStorage.getItem(key), STORAGE_KEY)).toBe(before);
  await expect(habitRow(page, 'Drink water')).toBeChecked();
});

test('V2C-30 · the whole sign-in flow keeps the console clean', async ({ page }) => {
  const problems: string[] = [];
  page.on('console', (msg) => {
    if (msg.type() === 'error' || msg.type() === 'warning') problems.push(msg.text());
  });
  page.on('pageerror', (err) => problems.push(err.message));

  const email = testEmail('console');
  await openApp(page);
  const { link } = await requestCode(page, email);
  await page.goto(link);
  await expectSignedIn(page, email);
  await openAccount(page);
  await page.getByRole('button', { name: 'Sign out' }).click();
  await expectSignedOut(page);

  expect(problems).toEqual([]);
});

test.describe('at the smallest supported phone width', () => {
  test.use({ viewport: { width: 375, height: 812 } });

  test('V2C-35 · adding the account button did not squeeze the tagline onto two lines', async ({ page }) => {
    // Caught by looking at a screenshot, not by a test, the first time. Now a test.
    await openApp(page);
    const tagline = page.getByText('Little habits. Lots of love.');
    const lineHeight = await tagline.evaluate((el) => parseFloat(getComputedStyle(el).lineHeight));
    const box = await tagline.boundingBox();
    expect(box!.height).toBeLessThan(lineHeight * 1.5);
  });

  test('V2C-31 · the account popup fits on screen, with comfortable tap targets', async ({ page }) => {
    await openApp(page);
    await openAccount(page);

    const dialog = await page.getByRole('dialog', { name: 'Account' }).boundingBox();
    expect(dialog!.x).toBeGreaterThanOrEqual(0);
    expect(dialog!.x + dialog!.width).toBeLessThanOrEqual(375);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= 375)).toBe(true);

    for (const target of [accountButton(page), page.getByRole('button', { name: 'Email me a code' })]) {
      const box = await target.boundingBox();
      expect(box!.height).toBeGreaterThanOrEqual(44);
    }
  });
});
