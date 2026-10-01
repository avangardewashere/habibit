import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { requireLocalSupabase, testEmail } from '@/test-support/local-supabase';

/*
 * v4 Block F: which habit reminders are due, against a real Postgres.
 *
 * Two hard questions meet here, and both are asked in SQL so they can be
 * tested at all: "has eight o'clock passed *for you*" (v3's, carried over) and
 * "is this habit due today at all" (v4 Block B's, now written a second time in
 * SQL). The second is the one that could quietly drift from the app's own rule,
 * so the cases below deliberately mirror lib/schedule.test.ts.
 *
 *   2026-10-05 Mon · 06 Tue · 07 Wed · 08 Thu · 09 Fri · 10 Sat · 11 Sun
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

/** The timezone row. `enabled` is the *daily nudge*, which per-habit reminders don't need. */
async function clockIn(user: TestUser, timezone: string, extra: Record<string, unknown> = {}) {
  const { error } = await admin
    .from('reminder_settings')
    .upsert({ user_id: user.id, enabled: false, local_time: '20:00', timezone, last_sent_on: null, ...extra });
  if (error) throw error;
}

async function giveHabit(user: TestUser, title: string, extra: Record<string, unknown> = {}) {
  const id = crypto.randomUUID();
  const at = '2026-09-01T00:00:00.000Z';
  const { error } = await admin
    .from('habits')
    .insert({ user_id: user.id, id, title, created_at: at, updated_at: at, ...extra });
  if (error) throw error;
  return id;
}

async function remind(user: TestUser, habitId: string, extra: Record<string, unknown> = {}) {
  const { error } = await admin
    .from('habit_reminders')
    .upsert({ user_id: user.id, habit_id: habitId, enabled: true, local_time: '08:00', last_sent_on: null, ...extra });
  if (error) throw error;
}

async function markDone(user: TestUser, habitId: string, day: string) {
  const { error } = await admin
    .from('completions')
    .upsert({ user_id: user.id, habit_id: habitId, day, done: true, updated_at: '2026-10-05T00:00:00.000Z' });
  if (error) throw error;
}

type DueRow = { user_id: string; habit_id: string; title: string; say_name: boolean; local_date: string };

async function dueAt(moment: string): Promise<DueRow[]> {
  const { data, error } = await admin.rpc('habit_reminders_due', { moment });
  if (error) throw error;
  return data as DueRow[];
}

async function claimAt(moment: string): Promise<DueRow[]> {
  const { data, error } = await admin.rpc('claim_due_habit_reminders', { moment });
  if (error) throw error;
  return data as DueRow[];
}

/** 08:00 in Manila (UTC+8) on the given local date. */
const manilaMorning = (day: string, time = '08:00') => `${day}T${time}:00+08:00`;

let user: TestUser;
let other: TestUser;
const created: TestUser[] = [];
let daily: string; // every day
let monWedFri: string;
let twiceAWeek: string;

beforeAll(async () => {
  [user, other] = await Promise.all([signedInUser('habit-due'), signedInUser('habit-due-other')]);
  created.push(user, other);
  await Promise.all([clockIn(user, 'Asia/Manila'), clockIn(other, 'Europe/London')]);
  daily = await giveHabit(user, 'Take medication');
  monWedFri = await giveHabit(user, 'Run', { schedule: 'weekdays:0,2,4' });
  twiceAWeek = await giveHabit(user, 'Gym', { schedule: 'weekly:2' });
});

afterAll(async () => {
  await Promise.all(created.map((u) => admin.auth.admin.deleteUser(u.id)));
});

beforeEach(async () => {
  await admin.from('habit_reminders').delete().eq('user_id', user.id);
  await admin.from('habit_reminders').delete().eq('user_id', other.id);
  await admin.from('completions').delete().eq('user_id', user.id);
  await clockIn(user, 'Asia/Manila');
});

describe('V4F: which habit reminders are due', () => {
  it('V4F-40 · ⭐ a habit whose time has come, on a day it is due', async () => {
    await remind(user, daily, { local_time: '08:00' });

    const due = await dueAt(manilaMorning('2026-10-06'));

    expect(due).toHaveLength(1);
    expect(due[0]).toMatchObject({ habit_id: daily, title: 'Take medication', say_name: false, local_date: '2026-10-06' });
  });

  it('V4F-41 · ⭐ nothing before the time, and nothing more than two hours after', async () => {
    await remind(user, daily, { local_time: '08:00' });

    expect(await dueAt(manilaMorning('2026-10-06', '07:45'))).toEqual([]);
    // A sender ten minutes late still catches it…
    expect(await dueAt(manilaMorning('2026-10-06', '08:10'))).toHaveLength(1);
    expect(await dueAt(manilaMorning('2026-10-06', '09:59'))).toHaveLength(1);
    // …and one that was down overnight doesn't wake you at lunchtime.
    expect(await dueAt(manilaMorning('2026-10-06', '10:01'))).toEqual([]);
  });

  it('V4F-42 · ⭐ on your clock, not the server’s', async () => {
    await remind(user, daily, { local_time: '08:00' });
    await clockIn(other, 'Europe/London');
    const theirs = await giveHabit(other, 'Read');
    await remind(other, theirs, { local_time: '08:00' });

    // 08:00 in Manila is 01:00 in London: only one of them is due.
    const due = await dueAt('2026-10-06T00:00:00Z');
    expect(due.map((row) => row.user_id)).toEqual([user.id]);

    // And 08:00 in London is 15:00 in Manila, by which time theirs is due and
    // this one's two-hour window is long gone.
    const later = await dueAt('2026-10-06T07:00:00Z');
    expect(later.map((row) => row.user_id)).toEqual([other.id]);
  });

  it('V4F-43 · ⭐ a habit already done today is not reminded about', async () => {
    await remind(user, daily, { local_time: '08:00' });
    await markDone(user, daily, '2026-10-06');

    expect(await dueAt(manilaMorning('2026-10-06'))).toEqual([]);
  });

  it('V4F-44 · ⭐ a Mon/Wed/Fri habit is reminded on Mon, Wed and Fri only', async () => {
    await remind(user, monWedFri, { local_time: '08:00' });

    const days = ['2026-10-05', '2026-10-06', '2026-10-07', '2026-10-08', '2026-10-09', '2026-10-10', '2026-10-11'];
    const reminded = [];
    for (const day of days) if ((await dueAt(manilaMorning(day))).length > 0) reminded.push(day);

    expect(reminded).toEqual(['2026-10-05', '2026-10-07', '2026-10-09']);
  });

  it('V4F-45 · ⭐ a twice-a-week habit stops once the week’s target is met, and starts again on Monday', async () => {
    await remind(user, twiceAWeek, { local_time: '08:00' });

    expect(await dueAt(manilaMorning('2026-10-07'))).toHaveLength(1);

    await markDone(user, twiceAWeek, '2026-10-05');
    await markDone(user, twiceAWeek, '2026-10-06');
    // Two other days this week are done: nothing more is being asked for.
    expect(await dueAt(manilaMorning('2026-10-07'))).toEqual([]);
    expect(await dueAt(manilaMorning('2026-10-11'))).toEqual([]);
    // Monday is a new week.
    expect(await dueAt(manilaMorning('2026-10-12'))).toHaveLength(1);
  });

  it('V4F-46 · ⭐ a schedule this database has never heard of is reminded, not silently dropped', async () => {
    const future = await giveHabit(user, 'Water plants', { schedule: 'every:3d' });
    await remind(user, future, { local_time: '08:00' });

    expect(await dueAt(manilaMorning('2026-10-06'))).toHaveLength(1);
  });

  it('V4F-47 · an archived or deleted habit is never reminded about', async () => {
    const archived = await giveHabit(user, 'Old thing', { archived_at: '2026-09-20T00:00:00.000Z' });
    const deleted = await giveHabit(user, 'Gone', { deleted_at: '2026-09-20T00:00:00.000Z' });
    await remind(user, archived, { local_time: '08:00' });
    await remind(user, deleted, { local_time: '08:00' });

    expect(await dueAt(manilaMorning('2026-10-06'))).toEqual([]);
  });

  it('V4F-48 · ⭐ a nonsense timezone costs that person their reminder and nobody else theirs', async () => {
    // v3's bug, in a new place: a zone Postgres has never heard of is an error
    // that would end the whole query and cost *everybody* their reminders.
    await remind(user, daily, { local_time: '08:00' });
    await clockIn(other, 'Mars/Olympus_Mons');
    const theirs = await giveHabit(other, 'Read');
    await remind(other, theirs, { local_time: '08:00' });

    const due = await dueAt(manilaMorning('2026-10-06'));
    expect(due.map((row) => row.user_id)).toEqual([user.id]);
  });

  it('V4F-49 · ⭐ claiming marks it sent, so a second run in the same window sends nothing', async () => {
    await remind(user, daily, { local_time: '08:00' });

    const first = await claimAt(manilaMorning('2026-10-06'));
    expect(first).toHaveLength(1);

    expect(await claimAt(manilaMorning('2026-10-06', '08:30'))).toEqual([]);
    // Tomorrow it comes round again.
    expect(await claimAt(manilaMorning('2026-10-07'))).toHaveLength(1);
  });

  it('V4F-50 · ⭐ each habit is claimed on its own: one sent, another still waiting', async () => {
    await remind(user, daily, { local_time: '08:00' });
    await remind(user, monWedFri, { local_time: '09:00' });

    const first = await claimAt(manilaMorning('2026-10-07', '08:00'));
    expect(first.map((row) => row.habit_id)).toEqual([daily]);

    const second = await claimAt(manilaMorning('2026-10-07', '09:00'));
    expect(second.map((row) => row.habit_id)).toEqual([monWedFri]);
  });

  it('V4F-51 · ⭐ the naming choice travels with the reminder', async () => {
    await remind(user, daily, { local_time: '08:00', say_name: true });

    const [row] = await dueAt(manilaMorning('2026-10-06'));
    expect(row).toMatchObject({ say_name: true, title: 'Take medication' });
  });

  it('V4F-52 · a per-habit reminder works whether or not the daily nudge is on', async () => {
    await clockIn(user, 'Asia/Manila', { enabled: false });
    await remind(user, daily, { local_time: '08:00' });

    expect(await dueAt(manilaMorning('2026-10-06'))).toHaveLength(1);
  });

  it('V4F-53 · ⭐ nobody but the sender can ask, or claim', async () => {
    // Both functions read across every account, so a signed-in browser — which
    // is what `authenticated` is — must not be able to call them at all.
    for (const fn of ['habit_reminders_due', 'claim_due_habit_reminders']) {
      const { error } = await user.db.rpc(fn, {});
      expect(error?.code, fn).toBe('42501'); // permission denied
    }
    const { error } = await user.db.rpc('habit_due_on', {
      p_user: user.id,
      p_habit: daily,
      p_schedule: null,
      p_day: '2026-10-06',
    });
    expect(error?.code).toBe('42501');
  });
});

describe('V4F: the schedule rule itself, asked directly', () => {
  /*
   * `habit_due_on` is lib/schedule.ts's `isDueOn` written a second time, in
   * SQL. Having the rule twice is the real cost of deciding who to wake inside
   * the database, so these cases deliberately mirror the TypeScript ones —
   * including the one the sender's own query happens to hide.
   */
  const dueOn = async (schedule: string | null, day: string, habitId = twiceAWeek) => {
    const { data, error } = await admin.rpc('habit_due_on', {
      p_user: user.id,
      p_habit: habitId,
      p_schedule: schedule,
      p_day: day,
    });
    if (error) throw error;
    return data as boolean;
  };

  it('V4F-57 · ⭐ every day, chosen weekdays, and anything unreadable', async () => {
    expect(await dueOn(null, '2026-10-06')).toBe(true);
    expect(await dueOn('daily', '2026-10-06')).toBe(true);
    // Monday is 0: Mon/Wed/Fri is due on Wednesday, not on Tuesday.
    expect(await dueOn('weekdays:0,2,4', '2026-10-07')).toBe(true);
    expect(await dueOn('weekdays:0,2,4', '2026-10-06')).toBe(false);
    // A schedule from a newer build, and a malformed one: due, never hidden.
    expect(await dueOn('every:3d', '2026-10-06')).toBe(true);
    expect(await dueOn('weekdays:', '2026-10-06')).toBe(true);
    expect(await dueOn('weekdays:9', '2026-10-06')).toBe(true);
  });

  it('V4F-58 · ⭐ the day being asked about never counts towards its own weekly target', async () => {
    // Twice a week, with Monday and *today* done. Counting today would make
    // the answer "not due", which would quietly contradict the app: there, a
    // habit you tick today stays today's business. The sender's own query
    // never sees this case — it drops habits already done — so without this
    // test the two rules could drift apart unnoticed.
    await markDone(user, twiceAWeek, '2026-10-05');
    await markDone(user, twiceAWeek, '2026-10-07');

    expect(await dueOn('weekly:2', '2026-10-07')).toBe(true);
    // The next day, those same two days are two other days: nothing is asked.
    expect(await dueOn('weekly:2', '2026-10-08')).toBe(false);
  });

  it('V4F-59 · ⭐ the week it counts is Monday to Sunday', async () => {
    await markDone(user, twiceAWeek, '2026-10-10'); // Saturday
    await markDone(user, twiceAWeek, '2026-10-11'); // Sunday

    expect(await dueOn('weekly:2', '2026-10-09')).toBe(false); // Friday, same week
    expect(await dueOn('weekly:2', '2026-10-12')).toBe(true); // Monday, a fresh week
  });
});

describe('V4F: the daily nudge and the per-habit ones do not double up', () => {
  /*
   * Its own person, with exactly three habits and nothing else, because these
   * tests are about a count. Sharing the user above would make them depend on
   * which other tests had run first.
   */
  let nudged: TestUser;
  let three: string[];

  beforeAll(async () => {
    nudged = await signedInUser('habit-due-nudge');
    created.push(nudged);
    three = [
      await giveHabit(nudged, 'Water'),
      await giveHabit(nudged, 'Stretch'),
      await giveHabit(nudged, 'Read'),
    ];
  });

  beforeEach(async () => {
    await admin.from('habit_reminders').delete().eq('user_id', nudged.id);
    await clockIn(nudged, 'Asia/Manila', { enabled: true, local_time: '20:00' });
  });

  const nudgeAt = async (moment: string) => {
    const { data, error } = await admin.rpc('reminders_due', { moment });
    if (error) throw error;
    return (data as { user_id: string; unfinished: number }[]).find((row) => row.user_id === nudged.id);
  };

  it('V4F-54 · ⭐ a habit with its own reminder is not counted by the daily nudge', async () => {
    await remind(nudged, three[0], { local_time: '08:00' });

    // Three habits, one of which does its own telling: two left to nudge about.
    expect((await nudgeAt(manilaMorning('2026-10-06', '20:00')))?.unfinished).toBe(2);
  });

  it('V4F-55 · ⭐ with every unfinished habit speaking for itself, no nudge arrives at all', async () => {
    for (const habit of three) await remind(nudged, habit, { local_time: '08:00' });

    expect(await nudgeAt(manilaMorning('2026-10-06', '20:00'))).toBeUndefined();
  });

  it('V4F-56 · turning a habit’s reminder off puts it back in the daily count', async () => {
    await remind(nudged, three[0], { local_time: '08:00', enabled: false });

    expect((await nudgeAt(manilaMorning('2026-10-06', '20:00')))?.unfinished).toBe(3);
  });
});
