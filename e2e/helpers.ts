import { expect, type Page } from '@playwright/test';

/** Must match `STORAGE_KEY` / `CORRUPT_KEY` / `THEME_KEY` in lib/. */
export const STORAGE_KEY = 'habibit:state';
export const CORRUPT_KEY = 'habibit:state:corrupt';
export const THEME_KEY = 'habibit:theme';

type SeedHabit = { id: string; title: string };
type SeedTask = { id: string; title: string; done?: boolean };

/**
 * Builds a storage envelope in the exact shape `lib/storage.ts` writes, so a test
 * can start from "a returning user with a week of history" without tapping it
 * all in first.
 */
export function envelope({
  habits = [],
  tasks = [],
  completions = [],
}: {
  habits?: SeedHabit[];
  tasks?: SeedTask[];
  /** `[habitId, 'YYYY-MM-DD']` pairs. */
  completions?: [string, string][];
}) {
  const at = '2026-09-01T00:00:00.000Z';
  return {
    version: 2,
    state: {
      habits: habits.map((h) => ({ ...h, createdAt: at, updatedAt: at, archivedAt: null, deletedAt: null })),
      tasks: tasks.map((t) => ({
        id: t.id,
        title: t.title,
        createdAt: at,
        updatedAt: at,
        completedAt: t.done ? at : null,
        deletedAt: null,
      })),
      completions: Object.fromEntries(completions.map(([id, day]) => [`${id}::${day}`, { done: true, updatedAt: at }])),
    },
  };
}

/**
 * Seeds storage before the app's own scripts run.
 *
 * Only writes when the key is absent. Init scripts run again on every reload,
 * so an unconditional write would quietly undo whatever the test just did and
 * make every persistence test pass for the wrong reason.
 */
export async function seed(page: Page, data: object) {
  await seedRaw(page, JSON.stringify(data));
}

/** Like `seed`, but stores the exact bytes given — for real captured data. */
export async function seedRaw(page: Page, raw: string) {
  await page.addInitScript(
    ([key, value]) => {
      if (localStorage.getItem(key) === null) localStorage.setItem(key, value);
    },
    [STORAGE_KEY, raw] as const,
  );
}

/** Opens the app and waits until the client has hydrated (the 7-day header needs today). */
export async function openApp(page: Page) {
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Habibit' })).toBeVisible();
}

export async function addHabit(page: Page, title: string) {
  await page.getByRole('textbox', { name: 'Add a habit...' }).fill(title);
  await page.getByRole('button', { name: 'Add habit' }).click();
  await expect(habitRow(page, title)).toBeVisible();
}

export async function addTask(page: Page, title: string) {
  await page.getByRole('textbox', { name: 'Add a task...' }).fill(title);
  await page.getByRole('button', { name: 'Add task' }).click();
  await expect(page.getByRole('checkbox', { name: title, exact: true })).toBeVisible();
}

/** The row's big toggle. Its accessible name is exactly the title. */
export function habitRow(page: Page, title: string) {
  return page.getByRole('checkbox', { name: title, exact: true });
}

export function moreActions(page: Page, title: string) {
  return page.getByRole('button', { name: `More actions for ${title}`, exact: true });
}

/** The strip dot for today, whatever today is. */
export function todayDot(page: Page, title: string) {
  return page.getByRole('button', { name: new RegExp(`^${escape(title)} — .*\\(today\\)`) });
}

export function streakBadge(page: Page, days: number) {
  return page.getByLabel(`${days} day${days === 1 ? '' : 's'} in a row`, { exact: true });
}

/** Reads the raw stored envelope, as another tab or a reload would see it. */
export async function storedState(page: Page) {
  return page.evaluate((key) => {
    const raw = localStorage.getItem(key);
    return raw === null ? null : JSON.parse(raw);
  }, STORAGE_KEY);
}

function escape(text: string) {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
