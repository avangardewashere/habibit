import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { afterAll, describe, expect, it } from 'vitest';
import { supabaseRemote } from '@/lib/sync/remote';
import { syncOnce } from '@/lib/sync/sync';
import type { Habit, HabibitState } from '@/lib/types';
import { habibitReducer, stamp } from '@/store/reducer';
import { requireLocalSupabase, testEmail } from '@/test-support/local-supabase';

/*
 * v4 Block B: habit schedules against a real (local) Postgres.
 *
 * **The risk v4's plan singles out.** An installed copy of the app can be days
 * out of date, because a phone keeps running the version it last loaded. Sync
 * copies named columns only (lib/sync/rows.ts), so a build that has never heard
 * of `schedule` leaves it out of what it writes. Reading the code says an
 * upsert only overwrites the columns it sends, and that the schedule should
 * therefore survive — but that is exactly the kind of reasoning that was wrong
 * in v3, so it is proved here rather than assumed (V4B-61, V4B-64).
 */

const local = requireLocalSupabase();
const admin = createClient(local.url, local.secretKey, { auth: { persistSession: false } });

async function signedIn(label: string): Promise<{ id: string; db: SupabaseClient }> {
  const { data: link, error } = await admin.auth.admin.generateLink({ type: 'magiclink', email: testEmail(label) });
  if (error) throw error;
  const db = createClient(local.url, local.publishableKey, { auth: { persistSession: false } });
  const { data, error: verifyError } = await db.auth.verifyOtp({ token_hash: link.properties.hashed_token, type: 'email' });
  if (verifyError || !data.user) throw verifyError ?? new Error('no user');
  return { id: data.user.id, db };
}

const users: string[] = [];
afterAll(async () => {
  await Promise.all(users.map((id) => admin.auth.admin.deleteUser(id)));
});

async function newAccount(label: string) {
  const user = await signedIn(label);
  users.push(user.id);
  return { ...user, remote: supabaseRemote(user.db) };
}

const at = (minute: number) => new Date(Date.UTC(2026, 8, 30, 8, minute)).toISOString();
const habit = (title: string, updated = 0, id: string = crypto.randomUUID()): Habit => ({
  id,
  title,
  createdAt: at(0),
  updatedAt: at(updated),
  archivedAt: null,
  position: null,
  schedule: null,
  icon: null,
  colour: null,
  deletedAt: null,
});

/** The columns a build from before v4 knows about — nothing else. */
const olderBuildRow = (h: Habit, title = h.title, updated = 2) => ({
  id: h.id,
  title,
  created_at: h.createdAt,
  updated_at: at(updated),
  archived_at: null,
  deleted_at: null,
  position: h.position,
});

describe('V4B: habit schedules in the real database', () => {
  it('V4B-60 · ⭐ a schedule is stored, and reaches another device', async () => {
    const phone = await newAccount('schedule');
    const h = { ...habit('Run', 1), schedule: 'weekdays:0,2,4' };

    await syncOnce({ habits: [h], tasks: [], completions: {} }, phone.remote);

    const pulled = await phone.remote.pullSince(null);
    expect(pulled.state.habits.map((x) => x.schedule)).toEqual(['weekdays:0,2,4']);
  });

  it('V4B-61 · ⭐ an upload from an older build (no schedule column) leaves the stored schedule alone', async () => {
    const { db, remote } = await newAccount('schedule-old-build');
    const h = { ...habit('Run', 1), schedule: 'weekly:3' };
    await remote.push({ habits: [h], tasks: [], completions: [] });

    // The same habit, renamed on a phone still running v3: every column it
    // knows, and no mention of the one it doesn't.
    const { error } = await db.from('habits').upsert(olderBuildRow(h, 'Run 5k'), { onConflict: 'user_id,id' });
    expect(error).toBeNull();

    const [stored] = (await remote.pullSince(null)).state.habits;
    expect(stored).toMatchObject({ title: 'Run 5k', schedule: 'weekly:3' });
  });

  it('V4B-62 · a habit an older build created has no schedule, and reads back as every day', async () => {
    const { db, remote } = await newAccount('schedule-none');
    const h = habit('Walk');

    const { error } = await db.from('habits').insert(olderBuildRow(h, h.title, 0));
    expect(error).toBeNull();

    expect((await remote.pullSince(null)).state.habits).toEqual([{ ...h, schedule: null }]);
  });

  it('V4B-63 · ⭐ a schedule kind this build has never heard of survives an edit made here', async () => {
    // The other side of V4B-61: a *newer* build wrote something this one cannot
    // read. Renaming the habit here must not quietly rewrite it as every day.
    const { db, remote } = await newAccount('schedule-newer-build');
    const h = habit('Water plants', 1);
    const { error } = await db.from('habits').insert({ ...olderBuildRow(h, h.title, 1), schedule: 'every:3d' });
    expect(error).toBeNull();

    // This build pulls it, renames it, and syncs — the whole round trip.
    const pulled = await syncOnce({ habits: [], tasks: [], completions: {} }, remote);
    expect(pulled.merged.habits[0].schedule).toBe('every:3d');
    const renamed = habibitReducer(
      pulled.merged,
      stamp({ type: 'RENAME_HABIT', id: h.id, title: 'Water the plants' }, new Date(at(9))),
    );
    await syncOnce(renamed, remote);

    const [stored] = (await remote.pullSince(null)).state.habits;
    expect(stored).toMatchObject({ title: 'Water the plants', schedule: 'every:3d' });
  });

  it('V4B-64 · the database refuses a schedule that is not shaped like one', async () => {
    const { db } = await newAccount('schedule-bad');
    const h = habit('Walk');
    for (const schedule of ['WEEKLY:3', 'weekly 3', '', 'weekly;drop', 'x'.repeat(65)]) {
      const { error } = await db
        .from('habits')
        .insert({ ...olderBuildRow(h, h.title, 0), id: crypto.randomUUID(), schedule });
      expect(error?.code, schedule).toBe('23514'); // check_violation
    }
  });

  it('V4B-65 · two devices agree on a schedule change, latest wins', async () => {
    const { remote } = await newAccount('schedule-race');
    const id = crypto.randomUUID();
    const first = { ...habit('Stretch', 1, id), schedule: 'weekdays:0,2,4' };
    const second = { ...habit('Stretch', 5, id), schedule: 'weekly:2' };

    await remote.push({ habits: [second], tasks: [], completions: [] });
    // The slower device's older change arrives afterwards; the database refuses it.
    await remote.push({ habits: [first], tasks: [], completions: [] });

    const state: HabibitState = (await remote.pullSince(null)).state;
    expect(state.habits.map((x) => x.schedule)).toEqual(['weekly:2']);
  });
});
