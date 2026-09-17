import { createClient } from '@supabase/supabase-js';
import { expect, type Browser, type Page } from '@playwright/test';
import type { LocalSupabase } from '../test-support/local-supabase';
import { openApp } from './helpers';

/*
 * Shared by the browser tests that need a signed-in account (Blocks D and E).
 * Everything here talks to the local Supabase in Docker only.
 */

export const supabase = JSON.parse(process.env.HABIBIT_E2E_SUPABASE ?? 'null') as LocalSupabase | null;

export function admin() {
  return createClient(supabase!.url, supabase!.secretKey, { auth: { persistSession: false } });
}

/**
 * Signs this device in through the app's own link page. The one-time token comes
 * from the admin API instead of an email: Block C already tests real emails, and
 * skipping the inbox keeps these tests about sync.
 */
export async function signIn(page: Page, email: string): Promise<string> {
  const { data, error } = await admin().auth.admin.generateLink({ type: 'magiclink', email });
  if (error) throw error;
  await page.goto(`/auth/confirm?token_hash=${data.properties!.hashed_token}&type=email`);
  await expect(page.getByRole('button', { name: `Account: signed in as ${email}` })).toBeVisible();
  return data.user.id;
}

export async function openAccount(page: Page) {
  await page.getByRole('button', { name: /^Account:/ }).click();
  await expect(page.getByRole('dialog', { name: 'Account' })).toBeVisible();
}

export async function expectSynced(page: Page) {
  await openAccount(page);
  await expect(page.getByRole('status').filter({ hasText: 'Synced' })).toBeVisible({ timeout: 15_000 });
  await page.keyboard.press('Escape');
}

export async function newDevice(browser: Browser) {
  const context = await browser.newContext();
  const page = await context.newPage();
  await openApp(page);
  return { context, page };
}

export async function accountHabitTitles(userId: string) {
  const { data } = await admin().from('habits').select('title').eq('user_id', userId).is('deleted_at', null).order('title');
  return (data ?? []).map((row) => row.title);
}

export async function seedAccount(email: string, titles: string[]) {
  const { data } = await admin().auth.admin.generateLink({ type: 'magiclink', email });
  const userId = data.user!.id;
  const at = '2026-09-01T00:00:00.000Z';
  const rows = titles.map((title) => ({
    user_id: userId,
    id: crypto.randomUUID(),
    title,
    created_at: at,
    updated_at: at,
    archived_at: null,
    deleted_at: null,
  }));
  const { error } = await admin().from('habits').insert(rows);
  if (error) throw error;
  return userId;
}
