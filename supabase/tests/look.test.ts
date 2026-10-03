import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { afterAll, describe, expect, it } from 'vitest';
import { NO_ICON } from '@/lib/look';
import { supabaseRemote } from '@/lib/sync/remote';
import { syncOnce } from '@/lib/sync/sync';
import type { Habit } from '@/lib/types';
import { habibitReducer, stamp } from '@/store/reducer';
import { requireLocalSupabase, testEmail } from '@/test-support/local-supabase';

/*
 * v5 Block A: a habit's colour and icon against a real (local) Postgres.
 *
 * The same risk v4 Block B proved for `schedule`, proved again because it is
 * the same shape of change: sync copies named columns only, so a phone still
 * running a build from before v5 uploads habits **without** `icon` and
 * `colour`. Reading the code says an upsert leaves unsent columns alone. That
 * held for `schedule`; it is tested here rather than assumed for these (V5A-61).
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

const at = (minute: number) => new Date(Date.UTC(2026, 9, 3, 8, minute)).toISOString();
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

/** The columns a build from v4 knows about — schedule, but no look. */
const v4Row = (h: Habit, title = h.title, updated = 2) => ({
  id: h.id,
  title,
  created_at: h.createdAt,
  updated_at: at(updated),
  archived_at: null,
  deleted_at: null,
  position: h.position,
  schedule: h.schedule,
});

describe('V5A: habit colour and icon in the real database', () => {
  it('V5A-60 · ⭐ a look is stored, and reaches another device', async () => {
    const { remote } = await newAccount('look');
    const h = { ...habit('Read', 1), icon: 'book-open', colour: 'teal' };

    await syncOnce({ habits: [h], tasks: [], completions: {} }, remote);

    const [stored] = (await remote.pullSince(null)).state.habits;
    expect(stored).toMatchObject({ icon: 'book-open', colour: 'teal' });
  });

  it('V5A-61 · ⭐ an upload from a v4 build (no look columns) leaves the stored look alone', async () => {
    const { db, remote } = await newAccount('look-old-build');
    const h = { ...habit('Read', 1), icon: 'book-open', colour: 'violet' };
    await remote.push({ habits: [h], tasks: [], completions: [] });

    // The same habit renamed on a phone still running v4: every column it
    // knows, and no mention of the two it doesn't.
    const { error } = await db.from('habits').upsert(v4Row(h, 'Read 20 pages'), { onConflict: 'user_id,id' });
    expect(error).toBeNull();

    const [stored] = (await remote.pullSince(null)).state.habits;
    expect(stored).toMatchObject({ title: 'Read 20 pages', icon: 'book-open', colour: 'violet' });
  });

  it('V5A-62 · a habit a v4 build created has no look stored, and reads back as nothing chosen', async () => {
    const { db, remote } = await newAccount('look-none');
    const h = habit('Walk');

    const { error } = await db.from('habits').insert(v4Row(h, h.title, 0));
    expect(error).toBeNull();

    expect((await remote.pullSince(null)).state.habits).toEqual([h]);
  });

  it('V5A-63 · ⭐ an icon this build has never heard of survives an edit made here', async () => {
    // The other side of V5A-61: a *newer* build chose something this one cannot
    // draw. Renaming the habit here must not quietly clear it.
    const { db, remote } = await newAccount('look-newer-build');
    const h = habit('Practise sax', 1);
    const { error } = await db.from('habits').insert({ ...v4Row(h, h.title, 1), icon: 'saxophone', colour: 'ultramarine' });
    expect(error).toBeNull();

    const pulled = await syncOnce({ habits: [], tasks: [], completions: {} }, remote);
    expect(pulled.merged.habits[0]).toMatchObject({ icon: 'saxophone', colour: 'ultramarine' });
    const renamed = habibitReducer(
      pulled.merged,
      stamp({ type: 'RENAME_HABIT', id: h.id, title: 'Practise saxophone' }, new Date(at(9))),
    );
    await syncOnce(renamed, remote);

    const [stored] = (await remote.pullSince(null)).state.habits;
    expect(stored).toMatchObject({ title: 'Practise saxophone', icon: 'saxophone', colour: 'ultramarine' });
  });

  it('V5A-64 · "no icon" is a value the database accepts', async () => {
    const { remote } = await newAccount('look-no-icon');
    const h = { ...habit('Read the news', 1), icon: NO_ICON };

    await remote.push({ habits: [h], tasks: [], completions: [] });

    expect((await remote.pullSince(null)).state.habits[0].icon).toBe(NO_ICON);
  });

  it('V5A-65 · ⭐ the database refuses a name that is not shaped like one', async () => {
    const { db } = await newAccount('look-bad');
    const h = habit('Walk');
    for (const bad of ['Teal', 'sea green', '', '-teal', '7teal', 'teal;drop', 'x'.repeat(25)]) {
      for (const column of ['icon', 'colour'] as const) {
        const { error } = await db
          .from('habits')
          .insert({ ...v4Row(h, h.title, 0), id: crypto.randomUUID(), [column]: bad });
        expect(error?.code, `${column} = ${JSON.stringify(bad)}`).toBe('23514'); // check_violation
      }
    }
  });

  it('V5A-66 · the longest name allowed is exactly the app’s limit', async () => {
    // lib/look.ts LONGEST_LOOK = 24. The two limits disagreeing would mean the
    // app could store something the database then refuses on every sync.
    const { db } = await newAccount('look-limit');
    const h = habit('Walk');
    const { error } = await db.from('habits').insert({ ...v4Row(h, h.title, 0), icon: 'a'.repeat(24) });
    expect(error).toBeNull();
  });

  it('V5A-67 · two devices agree on a look change, latest wins', async () => {
    const { remote } = await newAccount('look-race');
    const id = crypto.randomUUID();
    const first = { ...habit('Stretch', 1, id), colour: 'amber' };
    const second = { ...habit('Stretch', 5, id), colour: 'green' };

    await remote.push({ habits: [second], tasks: [], completions: [] });
    await remote.push({ habits: [first], tasks: [], completions: [] });

    expect((await remote.pullSince(null)).state.habits.map((x) => x.colour)).toEqual(['green']);
  });
});
