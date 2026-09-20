import { expect, test, type Locator, type Page } from '@playwright/test';
import { testEmail } from '../test-support/local-supabase';
import { expectSynced, newDevice, signIn, supabase } from './account-helpers';
import { addHabit, habitRow, moreActions, openApp, streakBadge, todayDot } from './helpers';

/*
 * v3 Block B: your own order (the Arrange mode), and archiving.
 */

const MIN_TAP = 44;

/** The habits as listed, top to bottom, in whichever mode the list is in. */
async function order(page: Page): Promise<string[]> {
  const handles = page.getByRole('button', { name: /^Reorder / });
  if ((await handles.count()) > 0) {
    return (await handles.evaluateAll((els) => els.map((el) => el.getAttribute('aria-label')!))).map((label) =>
      label.replace(/^Reorder /, ''),
    );
  }
  // The habits section comes first; its checkboxes are the habits, in order.
  return page.locator('section').first().getByRole('checkbox').allTextContents();
}

async function withHabits(page: Page, ...titles: string[]) {
  await openApp(page);
  for (const title of titles) await addHabit(page, title);
}

const arrange = (page: Page) => page.getByRole('button', { name: 'Arrange habits' }).click();
const done = (page: Page) => page.getByRole('button', { name: 'Done arranging habits' }).click();

async function box(locator: Locator) {
  const b = await locator.boundingBox();
  if (!b) throw new Error('element has no box');
  return b;
}

test('V3B-50 · ⭐ the ↑ / ↓ buttons reorder, and the order survives a reload', async ({ page }) => {
  await withHabits(page, 'Water', 'Stretch', 'Read');
  await arrange(page);

  const up = page.getByRole('button', { name: 'Move Read up' });
  await up.click();
  // Focus stays on the button after it moves, so a second press keeps going.
  await expect(up).toBeFocused();
  await up.click();
  await expect(up).toHaveAttribute('aria-disabled', 'true');
  expect(await order(page)).toEqual(['Read', 'Water', 'Stretch']);

  await done(page);
  expect(await order(page)).toEqual(['Read', 'Water', 'Stretch']);
  await page.reload();
  expect(await order(page)).toEqual(['Read', 'Water', 'Stretch']);
});

test('V3B-51 · dragging a handle moves a habit', async ({ page }) => {
  await withHabits(page, 'Water', 'Stretch', 'Read');
  await arrange(page);

  const from = await box(page.getByRole('button', { name: 'Reorder Read' }));
  const to = await box(page.getByRole('button', { name: 'Reorder Water' }));
  await page.mouse.move(from.x + from.width / 2, from.y + from.height / 2);
  await page.mouse.down();
  // In steps, like a real finger, so the list sees the drag travel over each row.
  await page.mouse.move(to.x + to.width / 2, to.y + 4, { steps: 12 });
  await page.mouse.up();

  await expect.poll(() => order(page)).toEqual(['Read', 'Water', 'Stretch']);
});

test('V3B-52 · a keyboard can move a habit: Space, arrow, Space', async ({ page }) => {
  await withHabits(page, 'Water', 'Stretch', 'Read');
  await arrange(page);

  await page.getByRole('button', { name: 'Reorder Water' }).focus();
  await page.keyboard.press('Space');
  await page.keyboard.press('ArrowDown');
  await page.keyboard.press('Space');

  // One arrow, one place. A second arrow pressed within the row's animation can
  // be dropped (see the report's known limits); ↑ / ↓ have no such limit.
  await expect.poll(() => order(page)).toEqual(['Stretch', 'Water', 'Read']);
});

test('V3B-53 · ⭐ archiving hides a habit; unarchiving brings it back in place, streak and all', async ({ page }) => {
  await withHabits(page, 'Water', 'Stretch', 'Read');
  await todayDot(page, 'Stretch').click();
  await expect(streakBadge(page, 1)).toBeVisible();

  await moreActions(page, 'Stretch').click();
  await page.getByRole('button', { name: 'Archive Stretch, keeping its history' }).click();

  await expect(habitRow(page, 'Stretch')).toHaveCount(0);
  await expect(page.getByText('0/2', { exact: true })).toBeVisible();
  const archived = page.getByRole('button', { name: 'Archived (1)' });
  await expect(archived).toHaveAttribute('aria-expanded', 'false');

  // Survives a reload while archived.
  await page.reload();
  await page.getByRole('button', { name: 'Archived (1)' }).click();
  await page.getByRole('button', { name: 'Unarchive Stretch' }).click();

  expect(await order(page)).toEqual(['Water', 'Stretch', 'Read']);
  await expect(habitRow(page, 'Stretch')).toBeChecked();
  await expect(streakBadge(page, 1)).toBeVisible();
  await expect(page.getByRole('button', { name: /^Archived/ })).toHaveCount(0);
});

test('V3B-54 · Arrange only appears with two or more habits, and adding waits while arranging', async ({ page }) => {
  await withHabits(page, 'Water');
  await expect(page.getByRole('button', { name: 'Arrange habits' })).toHaveCount(0);

  await addHabit(page, 'Stretch');
  await arrange(page);
  await expect(page.getByRole('textbox', { name: 'Add a habit...' })).toHaveCount(0);
  await done(page);
  await expect(page.getByRole('textbox', { name: 'Add a habit...' })).toBeVisible();
});

test.describe('at the smallest supported phone width', () => {
  test.use({ viewport: { width: 375, height: 812 } });

  test('V3B-55 · three menu pills fit inside the card, with a long title', async ({ page }) => {
    const long = 'A really quite long habit title that has to wrap somewhere sensible';
    await withHabits(page, long);
    await moreActions(page, long).click();

    const card = await box(page.locator('section').first().locator('.rounded-card').first());
    for (const name of [`Rename habit: ${long}`, `Archive ${long}, keeping its history`, /^Delete A really/]) {
      const pill = await box(page.getByRole('button', { name }));
      expect(pill.x).toBeGreaterThanOrEqual(card.x);
      expect(pill.x + pill.width).toBeLessThanOrEqual(card.x + card.width);
    }
    expect(await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth)).toBe(false);
  });

  test('V3B-56 · every new control is at least 44×44', async ({ page }) => {
    await withHabits(page, 'Water', 'Stretch');
    await moreActions(page, 'Stretch').click();
    const archive = page.getByRole('button', { name: 'Archive Stretch, keeping its history' });
    expect.soft((await box(archive)).height, 'Archive').toBeGreaterThanOrEqual(MIN_TAP);
    await archive.click();
    await page.getByRole('button', { name: 'Archived (1)' }).click();
    await addHabit(page, 'Read');

    const measured = [
      page.getByRole('button', { name: 'Archived (1)' }),
      page.getByRole('button', { name: 'Unarchive Stretch' }),
      page.getByRole('button', { name: 'Arrange habits' }),
    ];
    for (const target of measured) {
      const b = await box(target);
      expect.soft(b.height, (await target.getAttribute('aria-label')) ?? 'Archived toggle').toBeGreaterThanOrEqual(MIN_TAP);
    }

    await arrange(page);
    for (const target of [
      page.getByRole('button', { name: 'Done arranging habits' }),
      page.getByRole('button', { name: 'Reorder Water' }),
      page.getByRole('button', { name: 'Move Water up' }),
      page.getByRole('button', { name: 'Move Water down' }),
    ]) {
      const b = await box(target);
      const label = (await target.getAttribute('aria-label')) ?? '';
      expect.soft(b.height, label).toBeGreaterThanOrEqual(MIN_TAP);
      if (!label.startsWith('Done')) expect.soft(b.width, label).toBeGreaterThanOrEqual(MIN_TAP);
    }
  });
});

test.describe('with an account', () => {
  test.skip(!supabase, 'Needs local Supabase: start Docker, then `npm run db:start`.');

  test('V3B-57 · ⭐ a new order reaches your other device', async ({ page, browser }) => {
    const email = testEmail('arrange-sync');
    await openApp(page);
    await signIn(page, email);
    for (const title of ['Water', 'Stretch', 'Read']) await addHabit(page, title);

    await arrange(page);
    await page.getByRole('button', { name: 'Move Read up' }).click();
    await page.getByRole('button', { name: 'Move Read up' }).click();
    await done(page);
    await expectSynced(page);

    const pc = await newDevice(browser);
    await signIn(pc.page, email);
    await expectSynced(pc.page);
    await expect.poll(() => order(pc.page), { timeout: 10_000 }).toEqual(['Read', 'Water', 'Stretch']);
    await pc.context.close();
  });
});
