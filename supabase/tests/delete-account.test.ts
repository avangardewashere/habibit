import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { requireLocalSupabase, testEmail } from '@/test-support/local-supabase';

/*
 * v3 Block F: leaving, against a real database.
 *
 * Two things have to be true of a delete like this, and only a real Postgres can
 * show either: that **everything** goes (the cascades really do reach every
 * table), and that **only yours** goes.
 *
 * The second is why `delete_my_account()` takes no arguments. There is no id to
 * pass, so these tests cannot even express "delete someone else's" — which is
 * the point. What they can do is call it as one person and check the other
 * person is untouched.
 */

const local = requireLocalSupabase();
const admin = createClient(local.url, local.secretKey, { auth: { persistSession: false } });
const publicClient = () => createClient(local.url, local.publishableKey, { auth: { persistSession: false } });

type TestUser = { id: string; db: SupabaseClient };

async function signedInUser(label: string): Promise<TestUser> {
  const { data: link, error } = await admin.auth.admin.generateLink({ type: 'magiclink', email: testEmail(label) });
  if (error) throw error;
  const db = publicClient();
  const { data, error: verifyError } = await db.auth.verifyOtp({
    token_hash: link.properties.hashed_token,
    type: 'email',
  });
  if (verifyError || !data.user) throw verifyError ?? new Error('no user');
  return { id: data.user.id, db };
}

/** A full set: a habit, a task, a completion, a reminder, and a device. */
async function fillAccount(user: TestUser) {
  const at = '2026-09-01T00:00:00.000Z';
  const habitId = crypto.randomUUID();

  const results = await Promise.all([
    admin.from('habits').insert({ user_id: user.id, id: habitId, title: 'Water', created_at: at, updated_at: at }),
    admin
      .from('tasks')
      .insert({ user_id: user.id, id: crypto.randomUUID(), title: 'Post letter', created_at: at, updated_at: at }),
    admin
      .from('reminder_settings')
      .insert({ user_id: user.id, enabled: true, local_time: '20:00', timezone: 'Asia/Manila' }),
    admin.from('push_subscriptions').insert({
      user_id: user.id,
      endpoint: `https://push.example/${user.id}`,
      p256dh: 'p256dh-value',
      auth: 'auth-value',
    }),
  ]);
  // The completion points at the habit, so it goes after it.
  results.push(
    await admin
      .from('completions')
      .insert({ user_id: user.id, habit_id: habitId, day: '2026-09-01', done: true, updated_at: at }),
  );

  const errors = results.map((r) => r.error).filter(Boolean);
  if (errors.length) throw new Error(`Setup failed: ${JSON.stringify(errors)}`);
}

const TABLES = ['habits', 'tasks', 'completions', 'reminder_settings', 'push_subscriptions'] as const;

/** How many rows that account has, per table, read with full admin rights. */
async function rowsOf(userId: string): Promise<Record<string, number>> {
  const counts: Record<string, number> = {};
  for (const table of TABLES) {
    const { count, error } = await admin.from(table).select('*', { count: 'exact', head: true }).eq('user_id', userId);
    if (error) throw error;
    counts[table] = count ?? 0;
  }
  return counts;
}

async function accountExists(userId: string): Promise<boolean> {
  const { data } = await admin.auth.admin.getUserById(userId);
  return Boolean(data?.user);
}

let leaver: TestUser;
let stayer: TestUser;
const created: string[] = [];

beforeEach(async () => {
  // A fresh pair each time: these tests delete the people they use.
  [leaver, stayer] = await Promise.all([signedInUser('delete-leaver'), signedInUser('delete-stayer')]);
  created.push(leaver.id, stayer.id);
  await Promise.all([fillAccount(leaver), fillAccount(stayer)]);
});

afterAll(async () => {
  await Promise.all(created.map((id) => admin.auth.admin.deleteUser(id).catch(() => undefined)));
});

describe('V3F: deleting your account', () => {
  it('V3F-40 · ⭐ takes every table with it, and the account itself', async () => {
    expect(await rowsOf(leaver.id)).toEqual({
      habits: 1,
      tasks: 1,
      completions: 1,
      reminder_settings: 1,
      push_subscriptions: 1,
    });

    const { data, error } = await leaver.db.rpc('delete_my_account');

    expect(error).toBeNull();
    expect(data).toBe(true);
    expect(await rowsOf(leaver.id)).toEqual({
      habits: 0,
      tasks: 0,
      completions: 0,
      reminder_settings: 0,
      push_subscriptions: 0,
    });
    expect(await accountExists(leaver.id)).toBe(false);
  });

  it('V3F-41 · ⭐ leaves everyone else exactly as they were', async () => {
    await leaver.db.rpc('delete_my_account');

    expect(await rowsOf(stayer.id)).toEqual({
      habits: 1,
      tasks: 1,
      completions: 1,
      reminder_settings: 1,
      push_subscriptions: 1,
    });
    expect(await accountExists(stayer.id)).toBe(true);
  });

  it('V3F-42 · ⭐ a signed-out visitor cannot call it at all', async () => {
    const stranger = publicClient();

    const { error } = await stranger.rpc('delete_my_account');

    expect(error).not.toBeNull();
    expect(await accountExists(stayer.id)).toBe(true);
  });

  it('V3F-43 · ⭐ deleting twice is not an error, and the second time deletes nothing', async () => {
    // The browser's token keeps working until it expires, so a second tap — or
    // a second device — can arrive after the account has already gone.
    expect((await leaver.db.rpc('delete_my_account')).data).toBe(true);

    const { data, error } = await leaver.db.rpc('delete_my_account');

    expect(error).toBeNull();
    expect(data).toBe(false);
    expect(await accountExists(stayer.id), 'and nobody else was caught by it').toBe(true);
  });

  it('V3F-44 · ⭐ the function takes no arguments, so no id can be offered', async () => {
    // Not a formality: this is the guard. A version taking an id would need a
    // check that it is yours, and a check can be forgotten. Asking for someone
    // else here has to be a call the database has never heard of.
    const { error } = await leaver.db.rpc('delete_my_account', { user_id: stayer.id });

    expect(error).not.toBeNull();
    expect(await accountExists(stayer.id)).toBe(true);
    expect(await rowsOf(stayer.id)).toMatchObject({ habits: 1 });
  });

  it('V3F-45 · a deleted account’s token can no longer read anything', async () => {
    await leaver.db.rpc('delete_my_account');

    // The token is still signed and still in date; there is simply nothing
    // behind it any more.
    const { data } = await leaver.db.from('habits').select('*');
    expect(data ?? []).toEqual([]);
  });
});
