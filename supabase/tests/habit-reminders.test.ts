import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { requireLocalSupabase, testEmail } from '@/test-support/local-supabase';

/*
 * v4 Block E: a reminder for one habit, against a real database.
 *
 * Same treatment as every other table: nobody sees anyone else's rows, and a
 * signed-out visitor sees nothing at all. Two things are particular to this
 * one — a reminder can only ever point at a habit of your own, and naming the
 * habit is off unless you ask for it.
 */

const local = requireLocalSupabase();
const admin = createClient(local.url, local.secretKey, { auth: { persistSession: false } });

const publicClient = () => createClient(local.url, local.publishableKey, { auth: { persistSession: false } });

type TestUser = { id: string; db: SupabaseClient };

async function signedInUser(label: string): Promise<TestUser> {
  const { data: link, error } = await admin.auth.admin.generateLink({ type: 'magiclink', email: testEmail(label) });
  if (error) throw error;
  const db = publicClient();
  const { data, error: verifyError } = await db.auth.verifyOtp({ token_hash: link.properties.hashed_token, type: 'email' });
  if (verifyError || !data.user) throw verifyError ?? new Error('no user');
  return { id: data.user.id, db };
}

const at = '2026-10-01T08:00:00.000Z';
const habitRow = (id: string, title: string) => ({ id, title, created_at: at, updated_at: at });

let alice: TestUser;
let bob: TestUser;
const aliceHabit = crypto.randomUUID();
const bobHabit = crypto.randomUUID();

beforeAll(async () => {
  [alice, bob] = await Promise.all([signedInUser('habit-reminders-alice'), signedInUser('habit-reminders-bob')]);

  // Habits first: a reminder points at one, and the foreign key says so.
  const made = await Promise.all([
    alice.db.from('habits').insert(habitRow(aliceHabit, 'Take medication')),
    bob.db.from('habits').insert(habitRow(bobHabit, 'Call mum')),
  ]);
  const reminder = await alice.db.from('habit_reminders').insert({ habit_id: aliceHabit, local_time: '08:00' });
  const errors = [...made.map((m) => m.error), reminder.error].filter(Boolean);
  if (errors.length) throw new Error(`Test setup failed: ${JSON.stringify(errors)}`);
});

afterAll(async () => {
  await Promise.all([alice, bob].filter(Boolean).map((u) => admin.auth.admin.deleteUser(u.id)));
});

describe('V4E: per-habit reminders in the real database', () => {
  it('V4E-40 · ⭐ a reminder is stored, and naming the habit is off unless asked for', async () => {
    const { data, error } = await alice.db
      .from('habit_reminders')
      .select('habit_id,enabled,local_time,say_name')
      .eq('habit_id', aliceHabit)
      .single();

    expect(error).toBeNull();
    expect(data).toMatchObject({ habit_id: aliceHabit, enabled: true, local_time: '08:00:00', say_name: false });
  });

  it('V4E-41 · ⭐ nobody can read anyone else’s reminders', async () => {
    const { data, error } = await bob.db.from('habit_reminders').select('*');

    // Not an error — simply nothing. Row Level Security filters rather than refuses.
    expect(error).toBeNull();
    expect(data).toEqual([]);
  });

  it('V4E-42 · ⭐ nor change one', async () => {
    const { data } = await bob.db
      .from('habit_reminders')
      .update({ say_name: true, local_time: '03:00' })
      .eq('habit_id', aliceHabit)
      .select();
    expect(data).toEqual([]);

    const { data: mine } = await alice.db.from('habit_reminders').select('say_name,local_time').eq('habit_id', aliceHabit).single();
    expect(mine).toMatchObject({ say_name: false, local_time: '08:00:00' });
  });

  it('V4E-43 · ⭐ a reminder can only point at a habit of your own', async () => {
    // Bob tries to hang a reminder on Alice's habit. The foreign key includes
    // the user, so there is no such habit as far as Bob is concerned.
    const { error } = await bob.db.from('habit_reminders').insert({ habit_id: aliceHabit, local_time: '09:00' });

    expect(error?.code).toBe('23503'); // foreign_key_violation
  });

  it('V4E-44 · ⭐ a signed-out visitor sees nothing at all', async () => {
    const { data, error } = await publicClient().from('habit_reminders').select('*');

    expect(data).toBeNull();
    expect(error?.code).toBe('42501'); // permission denied
  });

  it('V4E-45 · the database refuses a time that is not a quarter hour', async () => {
    const id = crypto.randomUUID();
    await alice.db.from('habits').insert(habitRow(id, 'Stretch'));

    for (const local_time of ['08:07', '08:00:30', '08:59']) {
      const { error } = await alice.db.from('habit_reminders').insert({ habit_id: id, local_time });
      expect(error?.code, local_time).toBe('23514'); // check_violation
    }
  });

  it('V4E-46 · ⭐ deleting the habit takes its reminder with it', async () => {
    const id = crypto.randomUUID();
    await alice.db.from('habits').insert(habitRow(id, 'Temporary'));
    await alice.db.from('habit_reminders').insert({ habit_id: id, local_time: '12:00' });

    await alice.db.from('habits').delete().eq('id', id);

    const { data } = await alice.db.from('habit_reminders').select('habit_id').eq('habit_id', id);
    expect(data).toEqual([]);
  });

  it('V4E-47 · ⭐ turning one on records your clock without touching the daily nudge', async () => {
    // The daily nudge is on, at 8pm. Switching on a habit's reminder writes the
    // timezone only — an upsert touches just the columns it sends — so it can
    // never quietly turn the account-wide nudge off, or move its time.
    await alice.db.from('reminder_settings').insert({ enabled: true, local_time: '20:00', timezone: 'Asia/Manila' });

    const { error } = await alice.db
      .from('reminder_settings')
      .upsert({ timezone: 'Europe/Berlin', updated_at: new Date().toISOString() }, { onConflict: 'user_id' });
    expect(error).toBeNull();

    const { data } = await alice.db.from('reminder_settings').select('enabled,local_time,timezone').single();
    expect(data).toMatchObject({ enabled: true, local_time: '20:00:00', timezone: 'Europe/Berlin' });
  });

  it('V4E-48 · turning a reminder off keeps its time and naming choice', async () => {
    const id = crypto.randomUUID();
    await alice.db.from('habits').insert(habitRow(id, 'Yoga'));
    await alice.db.from('habit_reminders').insert({ habit_id: id, local_time: '06:30', say_name: true });

    await alice.db.from('habit_reminders').update({ enabled: false }).eq('habit_id', id);

    const { data } = await alice.db.from('habit_reminders').select('enabled,local_time,say_name').eq('habit_id', id).single();
    expect(data).toEqual({ enabled: false, local_time: '06:30:00', say_name: true });
  });
});
