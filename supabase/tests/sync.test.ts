import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { afterAll, describe, expect, it } from 'vitest';
import { changesToPush, mergeStates } from '@/lib/sync/merge';
import { supabaseRemote } from '@/lib/sync/remote';
import { changeCount, syncOnce } from '@/lib/sync/sync';
import type { Habit, HabibitState } from '@/lib/types';
import { requireLocalSupabase, testEmail } from '@/test-support/local-supabase';

/*
 * The sync code against a real (local) Supabase: real Row Level Security, real
 * upserts, real Postgres time formats, and the keep-latest-change trigger.
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

const at = (minute: number) => new Date(Date.UTC(2026, 8, 17, 8, minute)).toISOString();
const habit = (title: string, updated = 0, id: string = crypto.randomUUID()): Habit => ({
  id,
  title,
  createdAt: at(0),
  updatedAt: at(updated),
  archivedAt: null,
  deletedAt: null,
});

describe('V2D: sync against the real database', () => {
  it('V2D-40 · ⭐ a full device uploads into an empty account, and reads back identically', async () => {
    const { remote } = await newAccount('upload');
    const h = habit('Drink water', 1);
    const device: HabibitState = {
      habits: [h, { ...habit('Deleted', 2), deletedAt: at(2) }],
      tasks: [{ id: crypto.randomUUID(), title: 'Call mum', createdAt: at(0), updatedAt: at(3), completedAt: at(3), deletedAt: null }],
      completions: {
        [`${h.id}::2026-09-16`]: { done: true, updatedAt: at(4) },
        [`${h.id}::2026-09-17`]: { done: false, updatedAt: at(5) },
      },
    };

    const { merged } = await syncOnce(device, remote);

    expect(merged).toEqual(mergeStates(device, { habits: [], tasks: [], completions: {} }));
    // Read back through a fresh pull: exactly what was sent, tombstone and untick included.
    expect((await remote.pullSince(null)).state).toEqual(merged);
  });

  it('V2D-41 · a second device signing in to the same account receives everything', async () => {
    const phone = await newAccount('two-devices');
    const h = habit('Stretch', 1);
    await syncOnce({ habits: [h], tasks: [], completions: { [`${h.id}::2026-09-17`]: { done: true, updatedAt: at(2) } } }, phone.remote);

    // Same account, different "device": a new client with nothing on it.
    const { data } = await admin.auth.admin.getUserById(phone.id);
    const { data: link } = await admin.auth.admin.generateLink({ type: 'magiclink', email: data.user!.email! });
    const pcDb = createClient(local.url, local.publishableKey, { auth: { persistSession: false } });
    await pcDb.auth.verifyOtp({ token_hash: link!.properties!.hashed_token, type: 'email' });

    const { merged } = await syncOnce({ habits: [], tasks: [], completions: {} }, supabaseRemote(pcDb));
    expect(merged.habits.map((x) => x.title)).toEqual(['Stretch']);
    expect(merged.completions[`${h.id}::2026-09-17`]).toEqual({ done: true, updatedAt: at(2) });
  });

  it('V2D-42 · syncing an unchanged device again uploads nothing', async () => {
    const { remote } = await newAccount('again');
    const { merged } = await syncOnce({ habits: [habit('Read', 1)], tasks: [], completions: {} }, remote);
    const second = await syncOnce(merged, remote);
    expect(changeCount(second.pushed)).toBe(0);
  });

  it('V2D-43 · ⭐ an older version arriving late never overwrites a newer one (the database refuses)', async () => {
    const { remote } = await newAccount('race');
    const id = crypto.randomUUID();
    const newer = habit('Newer name', 9, id);
    const older = habit('Older name', 3, id);

    await remote.push({ habits: [newer], tasks: [], completions: [] });
    // A slow device uploads its stale copy afterwards, bypassing the merge.
    await remote.push({ habits: [older], tasks: [], completions: [] });

    expect(((await remote.pullSince(null)).state).habits).toEqual([newer]);
  });

  it('V2D-44 · …the same protection applies to ticks', async () => {
    const { remote } = await newAccount('race-tick');
    const h = habit('Walk', 1);
    await remote.push({
      habits: [h],
      tasks: [],
      completions: [[`${h.id}::2026-09-17`, { done: false, updatedAt: at(8) }]],
    });
    await remote.push({ habits: [], tasks: [], completions: [[`${h.id}::2026-09-17`, { done: true, updatedAt: at(2) }]] });

    expect(((await remote.pullSince(null)).state).completions[`${h.id}::2026-09-17`]).toEqual({ done: false, updatedAt: at(8) });
  });

  it('V2D-45 · a stale row in a batch does not stop the rest of the batch being stored', async () => {
    const { remote } = await newAccount('batch');
    const id = crypto.randomUUID();
    await remote.push({ habits: [habit('Current', 9, id)], tasks: [], completions: [] });

    const fresh = habit('Brand new', 1);
    await remote.push({ habits: [habit('Stale', 1, id), fresh], tasks: [], completions: [] });

    const titles = ((await remote.pullSince(null)).state).habits.map((h) => h.title).sort();
    expect(titles).toEqual(['Brand new', 'Current']);
  });

  it('V2D-46 · ⭐ more than 1,000 completions are all read back (reads are paged)', async () => {
    const { remote } = await newAccount('paging');
    const h = habit('Every day for years', 1);
    const completions: HabibitState['completions'] = {};
    const start = Date.UTC(2023, 0, 1);
    for (let d = 0; d < 1_250; d++) {
      const day = new Date(start + d * 86_400_000).toISOString().slice(0, 10);
      completions[`${h.id}::${day}`] = { done: true, updatedAt: at(1) };
    }
    const device: HabibitState = { habits: [h], tasks: [], completions };

    await remote.push(changesToPush(device, { habits: [], tasks: [], completions: {} }));
    const pulled = (await remote.pullSince(null)).state;

    expect(Object.keys(pulled.completions)).toHaveLength(1_250);
  });
});

describe('V2E: "what changed since?" against the real database', () => {
  const since = async (remote: ReturnType<typeof supabaseRemote>, cursor: string | null) => remote.pullSince(cursor);

  it('V2E-40 · ⭐ asking for changes since a pull returns only what was written after it', async () => {
    const { remote } = await newAccount('since');
    await remote.push({ habits: [habit('Old one', 1)], tasks: [], completions: [] });
    const first = await since(remote, null);
    expect(first.cursor).not.toBeNull();

    await new Promise((resolve) => setTimeout(resolve, 20));
    const fresh = habit('New one', 2);
    await remote.push({ habits: [fresh], tasks: [], completions: [] });

    const next = await since(remote, first.cursor);
    expect(next.state.habits.map((h) => h.title)).toEqual(['New one']);
    expect(Date.parse(next.cursor!)).toBeGreaterThan(Date.parse(first.cursor!));
  });

  it('V2E-41 · an edit counts as a change: the edited row comes back, with a later server time', async () => {
    const { remote } = await newAccount('since-edit');
    const h = habit('Drink watr', 1);
    await remote.push({ habits: [h], tasks: [], completions: [] });
    const first = await since(remote, null);

    await new Promise((resolve) => setTimeout(resolve, 20));
    await remote.push({ habits: [{ ...h, title: 'Drink water', updatedAt: at(5) }], tasks: [], completions: [] });

    const next = await since(remote, first.cursor);
    expect(next.state.habits.map((x) => x.title)).toEqual(['Drink water']);
  });

  it('V2E-42 · ⭐ a stale upload the database refuses is NOT reported as a change', async () => {
    // Otherwise every device would re-download a row that didn't actually change.
    const { remote } = await newAccount('since-stale');
    const id = crypto.randomUUID();
    await remote.push({ habits: [habit('Newer', 9, id)], tasks: [], completions: [] });
    const first = await since(remote, null);

    await new Promise((resolve) => setTimeout(resolve, 20));
    await remote.push({ habits: [habit('Older', 1, id)], tasks: [], completions: [] });

    const next = await since(remote, first.cursor);
    expect(next.state.habits).toEqual([]);
    expect(next.cursor).toBeNull();
  });

  it('V2E-43 · ticks and tasks are tracked the same way', async () => {
    const { remote } = await newAccount('since-all');
    const h = habit('Walk', 1);
    await remote.push({ habits: [h], tasks: [], completions: [] });
    const first = await since(remote, null);

    await new Promise((resolve) => setTimeout(resolve, 20));
    await remote.push({
      habits: [],
      tasks: [{ id: crypto.randomUUID(), title: 'Call mum', createdAt: at(0), updatedAt: at(3), completedAt: null, deletedAt: null }],
      completions: [[`${h.id}::2026-09-18`, { done: true, updatedAt: at(3) }]],
    });

    const next = await since(remote, first.cursor);
    expect(next.state.habits).toEqual([]);
    expect(next.state.tasks.map((t) => t.title)).toEqual(['Call mum']);
    expect(Object.keys(next.state.completions)).toEqual([`${h.id}::2026-09-18`]);
  });
});
