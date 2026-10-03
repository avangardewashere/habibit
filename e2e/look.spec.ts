import { expect, test, type Page } from '@playwright/test';
import { addHabit, envelope, habitRow, moreActions, openApp, seed, storedState, THEME_KEY } from './helpers';

/*
 * v5 Block A: a habit's colour and icon, in a real browser.
 *
 * The unit tests cover the rules. Two things only a browser can show:
 *
 * - **The colours actually reach the stylesheet.** Tailwind generates classes
 *   by reading the source as text, so a class name that is built at run time
 *   is correct in the markup and missing from the CSS — the circle would be
 *   the plain default colour and every unit test would still pass. These read
 *   the *computed* colour, which is the only thing that can tell.
 * - **Habits that already exist get a face**, with nothing stored and nothing
 *   migrated — the whole reason the look is derived rather than written.
 */

const COLOURS = ['coral', 'amber', 'green', 'teal', 'blue', 'violet'] as const;

/** The circle inside a habit's row: the decorated, aria-hidden part of the toggle. */
const circle = (page: Page, title: string) => habitRow(page, title).locator('span[aria-hidden]').first();

/** A CSS colour as the browser computes it, e.g. "rgb(14, 116, 144)". */
async function borderColour(page: Page, title: string) {
  return circle(page, title).evaluate((el) => getComputedStyle(el).borderTopColor);
}

/** A palette token, resolved the same way, for comparison. */
async function token(page: Page, name: string) {
  return page.evaluate((n) => {
    const probe = document.createElement('div');
    probe.style.color = `var(${n})`;
    document.body.appendChild(probe);
    const value = getComputedStyle(probe).color;
    probe.remove();
    return value;
  }, name);
}

async function openEdit(page: Page, title: string) {
  await moreActions(page, title).click();
  await page.getByRole('button', { name: new RegExp(`^Edit ${title}:`) }).click();
  await expect(page.getByRole('dialog')).toBeVisible();
}

test('V5A-70 · ⭐ a new habit arrives with a colour and an icon, chosen by nobody', async ({ page }) => {
  await openApp(page);
  await addHabit(page, 'Drink water');

  await expect(circle(page, 'Drink water').locator('svg.lucide-droplet')).toBeVisible();
  const colour = await borderColour(page, 'Drink water');
  const palette = await Promise.all(COLOURS.map((c) => token(page, `--color-hue-${c}`)));
  expect(palette).toContain(colour);

  // …and nothing was stored to get it.
  const stored = await storedState(page);
  expect(stored.state.habits[0]).toMatchObject({ icon: null, colour: null });
});

test('V5A-71 · ⭐ a habit saved before v5 gets a face too, without being rewritten', async ({ page }) => {
  // No icon or colour field at all: exactly what a v4 build left in storage.
  await seed(page, envelope({ habits: [{ id: 'old-1', title: 'Go for a run' }] }));
  await openApp(page);

  await expect(circle(page, 'Go for a run').locator('svg.lucide-footprints')).toBeVisible();
  const palette = await Promise.all(COLOURS.map((c) => token(page, `--color-hue-${c}`)));
  expect(palette).toContain(await borderColour(page, 'Go for a run'));
});

test('V5A-72 · ⭐ choosing a colour and an icon sticks, is stored, and survives a reload', async ({ page }) => {
  await openApp(page);
  await addHabit(page, 'Drink water');

  await openEdit(page, 'Drink water');
  await page.getByRole('button', { name: 'Violet', exact: true }).click();
  await page.getByRole('button', { name: 'Moon', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Moon', exact: true })).toHaveAttribute('aria-pressed', 'true');

  const stored = await storedState(page);
  expect(stored.state.habits[0]).toMatchObject({ icon: 'moon', colour: 'violet' });

  await page.getByRole('button', { name: 'Close' }).click();
  await page.reload();
  await expect(circle(page, 'Drink water').locator('svg.lucide-moon')).toBeVisible();
  expect(await borderColour(page, 'Drink water')).toBe(await token(page, '--color-hue-violet'));
});

test('V5A-73 · ⭐ every colour in the palette actually reaches the stylesheet', async ({ page }) => {
  // The Tailwind trap, checked colour by colour. One missing class and that
  // colour silently draws as the default — only the computed style shows it.
  await openApp(page);
  await addHabit(page, 'Stretch');
  await openEdit(page, 'Stretch');

  const dialog = page.getByRole('dialog');
  for (const c of COLOURS) {
    const name = c.charAt(0).toUpperCase() + c.slice(1);
    await dialog.getByRole('button', { name, exact: true }).click();
    // Polled, not read once: the circle fades between colours over 150ms, and a
    // single read straight after the click catches it halfway (V5A-73 did, once).
    const expected = await token(page, `--color-hue-${c}`);
    await expect.poll(() => borderColour(page, 'Stretch'), { message: c }).toBe(expected);
    // The icon's colour too. A ring with no colour class of its own falls back
    // to currentColor — the icon's colour — so checking the ring alone could
    // pass with half the palette missing.
    await expect
      .poll(() => circle(page, 'Stretch').evaluate((el) => getComputedStyle(el).color), { message: `${c} icon` })
      .toBe(expected);
  }
});

test('V5A-74 · "no icon" leaves a plain coloured ring', async ({ page }) => {
  await openApp(page);
  await addHabit(page, 'Read the news');
  await expect(circle(page, 'Read the news').locator('svg.lucide-book-open')).toBeVisible();

  await openEdit(page, 'Read the news');
  await page.getByRole('button', { name: 'No icon', exact: true }).click();
  await page.getByRole('button', { name: 'Close' }).click();

  await expect(circle(page, 'Read the news').locator('svg')).toHaveCount(0);
  expect((await storedState(page)).state.habits[0].icon).toBe('none');
});

test('V5A-75 · ⭐ the colours change with the theme', async ({ page }) => {
  // A hue dark enough to read on white disappears on plum. The dark values
  // exist and are contrast-tested; this checks they are the ones in use.
  await page.addInitScript((key) => localStorage.setItem(key, 'dark'), THEME_KEY);
  await openApp(page);
  await addHabit(page, 'Stretch');
  await openEdit(page, 'Stretch');
  await page.getByRole('dialog').getByRole('button', { name: 'Teal', exact: true }).click();

  const darkTeal = await token(page, '--dark-hue-teal');
  await expect.poll(() => borderColour(page, 'Stretch')).toBe(darkTeal);
  // And not the light value (#0E7490), which would be the dark rule not applying.
  expect(darkTeal).not.toBe('rgb(14, 116, 144)');
});

test('V5A-76 · the menu pill says Edit, and opens the habit’s own sheet', async ({ page }) => {
  await openApp(page);
  await addHabit(page, 'Meditate');

  await moreActions(page, 'Meditate').click();
  const edit = page.getByRole('button', { name: /^Edit Meditate:/ });
  await expect(edit).toHaveText('Edit');
  await edit.click();

  const dialog = page.getByRole('dialog');
  await expect(dialog.getByRole('heading', { name: 'Meditate', exact: true })).toBeVisible();
  for (const section of ['Look', 'How often']) {
    await expect(dialog.getByRole('heading', { name: section, exact: true })).toBeVisible();
  }
});
