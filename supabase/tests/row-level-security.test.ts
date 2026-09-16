import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { requireLocalSupabase, testEmail } from '@/test-support/local-supabase';

/*
 * The security boundary of the whole app.
 *
 * Habibit talks to the database straight from the browser with a *public* key.
 * Anyone can open DevTools and send any query they like with it. The only thing
 * standing between one person's habits and everyone else is Row Level Security
 * in supabase/migrations. These tests attack it the way a curious user would.
 *
 * Runs against local Supabase only (`npm run db:start`).
 */

const local = requireLocalSupabase();
const admin = createClient(local.url, local.secretKey, { auth: { persistSession: false } });

function publicClient(): SupabaseClient {
  return createClient(local.url, local.publishableKey, { auth: { persistSession: false } });
}

type TestUser = { id: string; email: string; db: SupabaseClient };

/** A real signed-in user, created through the same one-time-token flow the app uses. */
async function signedInUser(label: string): Promise<TestUser> {
  const email = testEmail(label);
  const { data: link, error } = await admin.auth.admin.generateLink({ type: 'magiclink', email });
  if (error) throw error;

  const db = publicClient();
  const { data, error: verifyError } = await db.auth.verifyOtp({
    token_hash: link.properties.hashed_token,
    type: 'email',
  });
  if (verifyError || !data.user) throw verifyError ?? new Error('no user');
  return { id: data.user.id, email, db };
}

const at = '2026-09-17T00:00:00.000Z';
const habitRow = (id: string, title = 'Drink water') => ({
  id,
  title,
  created_at: at,
  updated_at: at,
  archived_at: null,
  deleted_at: null,
});
const taskRow = (id: string) => ({
  id,
  title: 'Book dentist',
  created_at: at,
  updated_at: at,
  completed_at: null,
  deleted_at: null,
});

let alice: TestUser;
let bob: TestUser;
const aliceHabit = crypto.randomUUID();
const aliceTask = crypto.randomUUID();

beforeAll(async () => {
  [alice, bob] = await Promise.all([signedInUser('alice'), signedInUser('bob')]);

  const inserts = await Promise.all([
    alice.db.from('habits').insert(habitRow(aliceHabit)),
    alice.db.from('tasks').insert(taskRow(aliceTask)),
  ]);
  const { error: completionError } = await alice.db
    .from('completions')
    .insert({ habit_id: aliceHabit, day: '2026-09-17', done: true, updated_at: at });

  // Setup failing would skip every test below, so say exactly why.
  const setupErrors = [...inserts.map((r) => r.error), completionError].filter(Boolean);
  if (setupErrors.length) throw new Error(`Test setup failed: ${JSON.stringify(setupErrors)}`);
});

afterAll(async () => {
  await Promise.all([alice, bob].filter(Boolean).map((u) => admin.auth.admin.deleteUser(u.id)));
});

describe('signed out', () => {
  it.each(['habits', 'tasks', 'completions'])('V2C-01 · cannot read %s at all', async (table) => {
    const { data, error } = await publicClient().from(table).select('*');
    expect(data).toBeNull();
    expect(error?.code).toBe('42501'); // permission denied
  });

  it('V2C-02 · cannot write anything', async () => {
    const { error } = await publicClient().from('habits').insert(habitRow(crypto.randomUUID()));
    expect(error?.code).toBe('42501');
  });
});

describe('a signed-in user and their own data', () => {
  it('V2C-03 · reads back their own habit, task and completion', async () => {
    const [habits, tasks, completions] = await Promise.all([
      alice.db.from('habits').select('*'),
      alice.db.from('tasks').select('*'),
      alice.db.from('completions').select('*'),
    ]);
    expect(habits.data).toEqual([expect.objectContaining({ id: aliceHabit, user_id: alice.id })]);
    expect(tasks.data).toEqual([expect.objectContaining({ id: aliceTask, user_id: alice.id })]);
    expect(completions.data).toEqual([
      expect.objectContaining({ habit_id: aliceHabit, day: '2026-09-17', done: true, user_id: alice.id }),
    ]);
  });

  it('V2C-04 · user_id is filled in from their sign-in, not trusted from the app', async () => {
    const { data } = await alice.db.from('habits').select('user_id').eq('id', aliceHabit).single();
    expect(data?.user_id).toBe(alice.id);
  });

  it('V2C-05 · can change their own rows, e.g. a rename and a tombstone', async () => {
    const id = crypto.randomUUID();
    await alice.db.from('habits').insert(habitRow(id, 'Stretch'));
    const { data, error } = await alice.db
      .from('habits')
      .update({ title: 'Yoga', deleted_at: at, updated_at: at })
      .eq('id', id)
      .select();
    expect(error).toBeNull();
    expect(data).toEqual([expect.objectContaining({ title: 'Yoga', deleted_at: '2026-09-17T00:00:00+00:00' })]);
  });

  it('V2C-06 · an empty title is refused by the database too', async () => {
    const { error } = await alice.db.from('habits').insert(habitRow(crypto.randomUUID(), ''));
    expect(error?.code).toBe('23514'); // check constraint
  });
});

describe('⭐ another user trying to get at that data', () => {
  it.each(['habits', 'tasks', 'completions'])('V2C-07 · sees none of it when reading %s', async (table) => {
    const { data, error } = await bob.db.from(table).select('*');
    expect(error).toBeNull();
    expect(data).toEqual([]);
  });

  it('V2C-08 · even asking for the exact id returns nothing', async () => {
    const { data } = await bob.db.from('habits').select('*').eq('id', aliceHabit);
    expect(data).toEqual([]);
  });

  it('V2C-09 · cannot rename it', async () => {
    const { data } = await bob.db.from('habits').update({ title: 'Hacked' }).eq('id', aliceHabit).select();
    expect(data).toEqual([]);

    const { data: still } = await alice.db.from('habits').select('title').eq('id', aliceHabit).single();
    expect(still?.title).toBe('Drink water');
  });

  it('V2C-10 · cannot delete it', async () => {
    await bob.db.from('habits').delete().eq('id', aliceHabit);
    await bob.db.from('tasks').delete().eq('id', aliceTask);
    await bob.db.from('completions').delete().eq('habit_id', aliceHabit);

    const [habit, task, completion] = await Promise.all([
      alice.db.from('habits').select('id').eq('id', aliceHabit),
      alice.db.from('tasks').select('id').eq('id', aliceTask),
      alice.db.from('completions').select('habit_id').eq('habit_id', aliceHabit),
    ]);
    expect(habit.data).toHaveLength(1);
    expect(task.data).toHaveLength(1);
    expect(completion.data).toHaveLength(1);
  });

  it('V2C-11 · cannot plant a row in their account', async () => {
    const { error } = await bob.db.from('habits').insert({ ...habitRow(crypto.randomUUID(), 'Planted'), user_id: alice.id });
    expect(error?.code).toBe('42501'); // violates row-level security

    const { data } = await admin.from('habits').select('id').eq('user_id', alice.id).eq('title', 'Planted');
    expect(data).toEqual([]);
  });

  it('V2C-12 · cannot tick a habit that is not theirs', async () => {
    const { error } = await bob.db
      .from('completions')
      .insert({ habit_id: aliceHabit, day: '2026-09-18', done: true, updated_at: at });
    expect(error?.code).toBe('23503'); // foreign key: no such habit for this user
  });

  it('V2C-13 · cannot move their own row into someone else\'s account', async () => {
    const id = crypto.randomUUID();
    await bob.db.from('habits').insert(habitRow(id, 'Mine'));
    const { error } = await bob.db.from('habits').update({ user_id: alice.id }).eq('id', id);
    expect(error?.code).toBe('42501');
  });

  it('V2C-14 · reusing the same habit id is harmless: it is a separate row, not a takeover', async () => {
    // Ids are made on devices, so the key includes the user. Otherwise knowing
    // someone's habit id would let you block or collide with it.
    const { error } = await bob.db.from('habits').insert(habitRow(aliceHabit, "Bob's own"));
    expect(error).toBeNull();

    const { data: alicesView } = await alice.db.from('habits').select('title').eq('id', aliceHabit);
    const { data: bobsView } = await bob.db.from('habits').select('title').eq('id', aliceHabit);
    expect(alicesView).toEqual([{ title: 'Drink water' }]);
    expect(bobsView).toEqual([{ title: "Bob's own" }]);
  });
});

describe('deleting an account', () => {
  it('V2C-15 · removes every row that belonged to it', async () => {
    const carol = await signedInUser('carol');
    const habit = crypto.randomUUID();
    await carol.db.from('habits').insert(habitRow(habit));
    await carol.db.from('tasks').insert(taskRow(crypto.randomUUID()));
    await carol.db.from('completions').insert({ habit_id: habit, day: '2026-09-17', done: true, updated_at: at });

    await admin.auth.admin.deleteUser(carol.id);

    const counts = await Promise.all(
      ['habits', 'tasks', 'completions'].map((table) =>
        admin.from(table).select('*', { count: 'exact', head: true }).eq('user_id', carol.id),
      ),
    );
    expect(counts.map((c) => c.count)).toEqual([0, 0, 0]);
  });
});
