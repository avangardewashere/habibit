import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { requireLocalSupabase, testEmail } from '@/test-support/local-supabase';

/*
 * v3 Block E: who is due for a reminder, against a real Postgres.
 *
 * This is where the sender's hardest question lives — "has 8 pm passed *for
 * you*" — and it is asked in SQL precisely so it can be tested like this. Every
 * test below fixes an instant and asks the database who it would nudge at that
 * moment, which is something no amount of mocking would prove.
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

/** Gives `user` a reminder setting, replacing whatever was there. */
async function remindAt(user: TestUser, time: string, timezone: string, extra: Record<string, unknown> = {}) {
  const { error } = await admin
    .from('reminder_settings')
    .upsert({ user_id: user.id, enabled: true, local_time: time, timezone, last_sent_on: null, ...extra });
  if (error) throw error;
}

/** Gives `user` habits, none of them done. */
async function giveHabits(user: TestUser, titles: string[], extra: Record<string, unknown> = {}) {
  const at = '2026-09-01T00:00:00.000Z';
  const rows = titles.map((title) => ({
    user_id: user.id,
    id: crypto.randomUUID(),
    title,
    created_at: at,
    updated_at: at,
    ...extra,
  }));
  const { error } = await admin.from('habits').insert(rows);
  if (error) throw error;
  return rows.map((row) => row.id);
}

async function markDone(user: TestUser, habitId: string, day: string) {
  const { error } = await admin
    .from('completions')
    .upsert({ user_id: user.id, habit_id: habitId, day, done: true, updated_at: '2026-09-22T00:00:00.000Z' });
  if (error) throw error;
}

/** Who the database would nudge at `moment`, as a map of user id to count. */
async function dueAt(moment: string): Promise<Map<string, number>> {
  const { data, error } = await admin.rpc('reminders_due', { moment });
  if (error) throw error;
  return new Map((data as { user_id: string; unfinished: number }[]).map((row) => [row.user_id, row.unfinished]));
}

async function claimAt(moment: string) {
  const { data, error } = await admin.rpc('claim_due_reminders', { moment });
  if (error) throw error;
  return data as { user_id: string; local_date: string; unfinished: number }[];
}

let manila: TestUser;
let london: TestUser;
const created: TestUser[] = [];

beforeAll(async () => {
  [manila, london] = await Promise.all([signedInUser('due-manila'), signedInUser('due-london')]);
  created.push(manila, london);
  await Promise.all([giveHabits(manila, ['Water', 'Stretch']), giveHabits(london, ['Read'])]);
});

afterAll(async () => {
  await Promise.all(created.map((user) => admin.auth.admin.deleteUser(user.id)));
});

beforeEach(async () => {
  await Promise.all([
    remindAt(manila, '20:00', 'Asia/Manila'),
    remindAt(london, '20:00', 'Europe/London'),
    // Every test starts with nothing ticked. Without this, the test that marks
    // everything done leaves it done, and the tests after it quietly stop
    // meaning anything — the person they ask about has nothing left to do.
    ...created.map((user) => admin.from('completions').delete().eq('user_id', user.id)),
  ]);
});

describe('V3E: who is due', () => {
  /*
   * 2026-09-22T12:05Z is 20:05 in Manila (UTC+8) and 13:05 in London (UTC+1).
   * One instant, one asked-for time, two different answers — which is the whole
   * reason the time zone is stored next to the time.
   */
  const manilaEvening = '2026-09-22T12:05:00.000Z';

  it('V3E-40 · ⭐ 8 pm in Manila is not 8 pm in London', async () => {
    const due = await dueAt(manilaEvening);

    expect(due.has(manila.id)).toBe(true);
    expect(due.has(london.id)).toBe(false);
  });

  it('V3E-41 · ⭐ and seven hours later it is London’s turn, not Manila’s', async () => {
    // 19:05Z: 03:05 the next morning in Manila (long past the window), 20:05 in London.
    const due = await dueAt('2026-09-22T19:05:00.000Z');

    expect(due.has(london.id)).toBe(true);
    expect(due.has(manila.id)).toBe(false);
  });

  it('V3E-42 · ⭐ the count is what is still unfinished today', async () => {
    expect((await dueAt(manilaEvening)).get(manila.id)).toBe(2);
  });

  it('V3E-43 · ⭐ nothing is sent when everything is done', async () => {
    const habits = await giveHabits(manila, ['Extra']);
    const all = await admin.from('habits').select('id').eq('user_id', manila.id).is('deleted_at', null);
    for (const habit of all.data!) await markDone(manila, habit.id, '2026-09-22');

    expect((await dueAt(manilaEvening)).has(manila.id)).toBe(false);

    // Undone again, and the nudge comes back.
    await admin.from('completions').update({ done: false }).eq('user_id', manila.id).eq('habit_id', habits[0]);
    expect((await dueAt(manilaEvening)).get(manila.id)).toBe(1);

    await admin.from('habits').delete().eq('user_id', manila.id).eq('id', habits[0]);
  });

  it('V3E-44 · ⭐ a habit you archived or deleted is not something you are behind on', async () => {
    const user = await signedInUser('due-archived');
    created.push(user);
    await remindAt(user, '20:00', 'Asia/Manila');
    await giveHabits(user, ['Put away'], { archived_at: '2026-09-10T00:00:00.000Z' });
    await giveHabits(user, ['Gone'], { deleted_at: '2026-09-10T00:00:00.000Z' });

    expect((await dueAt(manilaEvening)).has(user.id)).toBe(false);

    // One live habit, and it counts.
    await giveHabits(user, ['Still here']);
    expect((await dueAt(manilaEvening)).get(user.id)).toBe(1);
  });

  it('V3E-45 · ⭐ reminders switched off means never due', async () => {
    await remindAt(manila, '20:00', 'Asia/Manila', { enabled: false });

    expect((await dueAt(manilaEvening)).has(manila.id)).toBe(false);
  });

  it('V3E-46 · ⭐ late is still worth sending, but not hours later', async () => {
    // The sender being down for ten minutes should not cost you the nudge; it
    // being down all night should not wake you at breakfast.
    expect((await dueAt('2026-09-22T13:55:00.000Z')).has(manila.id), '1h55 late').toBe(true);
    expect((await dueAt('2026-09-22T14:05:00.000Z')).has(manila.id), '2h05 late').toBe(false);
    expect((await dueAt('2026-09-22T11:55:00.000Z')).has(manila.id), 'five minutes early').toBe(false);
  });

  it('V3E-47 · ⭐ someone whose time zone Postgres has never heard of does not stop anyone else', async () => {
    const user = await signedInUser('due-badzone');
    created.push(user);
    await remindAt(user, '20:00', 'Mars/Olympus');
    await giveHabits(user, ['Breathe']);

    const due = await dueAt(manilaEvening);

    expect(due.has(user.id)).toBe(false);
    expect(due.has(manila.id), 'everyone else still gets theirs').toBe(true);
  });
});

describe('V3E: daylight saving', () => {
  /*
   * London puts its clocks back on 2026-10-25: 02:00 becomes 01:00, so 01:30
   * local happens twice. The clocks going forward on 2027-03-28 does the
   * opposite — 01:30 never happens at all.
   *
   * Neither may cost you a reminder, and neither may give you two.
   */
  let sleeper: TestUser;

  beforeAll(async () => {
    sleeper = await signedInUser('due-dst');
    created.push(sleeper);
    await giveHabits(sleeper, ['Sleep']);
  });

  it('V3E-48 · ⭐ an hour that happens twice sends one reminder, not two', async () => {
    await remindAt(sleeper, '01:30', 'Europe/London');

    // 00:35Z is 01:35 BST; 01:35Z is 01:35 GMT — the same local time, twice.
    const first = await claimAt('2026-10-25T00:35:00.000Z');
    const second = await claimAt('2026-10-25T01:35:00.000Z');

    expect(first.map((row) => row.user_id)).toContain(sleeper.id);
    expect(second.map((row) => row.user_id)).not.toContain(sleeper.id);
  });

  it('V3E-49 · ⭐ an hour that never happens still sends one', async () => {
    await remindAt(sleeper, '01:30', 'Europe/London');

    // 01:00 GMT becomes 02:00 BST, so 01:30 is skipped entirely. The next
    // quarter hour the sender wakes up, it is 02:00 local and still worth it.
    const due = await dueAt('2027-03-28T01:00:00.000Z');

    expect(due.has(sleeper.id)).toBe(true);
  });
});

describe('V3E: claiming', () => {
  let twice: TestUser;

  beforeAll(async () => {
    twice = await signedInUser('due-twice');
    created.push(twice);
    await giveHabits(twice, ['Once']);
  });

  it('V3E-50 · ⭐ claiming twice in the same evening sends once', async () => {
    await remindAt(twice, '20:00', 'Asia/Manila');

    const first = await claimAt('2026-09-22T12:05:00.000Z');
    const second = await claimAt('2026-09-22T12:20:00.000Z');

    expect(first.map((row) => row.user_id)).toContain(twice.id);
    expect(second.map((row) => row.user_id)).not.toContain(twice.id);
  });

  it('V3E-51 · ⭐ and the next evening it comes round again', async () => {
    await remindAt(twice, '20:00', 'Asia/Manila', { last_sent_on: '2026-09-22' });

    const tomorrow = await claimAt('2026-09-23T12:05:00.000Z');

    expect(tomorrow.map((row) => row.user_id)).toContain(twice.id);
  });

  it('V3E-52 · claiming writes down the date on your clock, not ours', async () => {
    // 2026-09-22T16:30Z is already the 23rd in Manila.
    await remindAt(twice, '00:30', 'Asia/Manila');
    await claimAt('2026-09-22T16:35:00.000Z');

    const { data } = await admin.from('reminder_settings').select('last_sent_on').eq('user_id', twice.id).single();
    expect(data!.last_sent_on).toBe('2026-09-23');
  });
});

describe('V3E: nobody but the sender', () => {
  it('V3E-53 · ⭐ a signed-in person cannot ask who is due, or claim them', async () => {
    for (const fn of ['reminders_due', 'claim_due_reminders']) {
      const { error } = await manila.db.rpc(fn, { moment: '2026-09-22T12:05:00.000Z' });
      // Either the function is invisible or calling it is refused; both are no.
      expect(error, fn).not.toBeNull();
      expect(['42501', 'PGRST202'], `${fn}: ${error?.code} ${error?.message}`).toContain(error!.code);
    }
  });

  it('V3E-54 · ⭐ nor can a signed-out visitor', async () => {
    const stranger = publicClient();
    for (const fn of ['reminders_due', 'claim_due_reminders']) {
      const { error } = await stranger.rpc(fn, { moment: '2026-09-22T12:05:00.000Z' });
      expect(error, fn).not.toBeNull();
    }
  });

  it('V3E-55 · ⭐ and nobody can write their own “already sent” date to get an extra one', async () => {
    // last_sent_on is the sender's bookkeeping. Row Level Security lets you
    // change your own row, so the guard that matters is that changing it only
    // ever means *fewer* reminders for you, never more, and never anyone else's.
    const { error } = await manila.db
      .from('reminder_settings')
      .update({ last_sent_on: '2020-01-01' })
      .eq('user_id', london.id);
    expect(error).toBeNull();

    const { data } = await admin.from('reminder_settings').select('last_sent_on').eq('user_id', london.id).single();
    expect(data!.last_sent_on, 'London’s row is untouched').toBeNull();
  });
});
