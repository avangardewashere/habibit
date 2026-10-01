import { describe, expect, it } from 'vitest';
import {
  habitReminderNotification,
  isAuthorised,
  isGone,
  reminderNotification,
  sendHabitReminders,
  sendReminders,
  type Device,
  type DueHabitReminder,
  type DueReminder,
  type Notification,
  type SendOutcome,
} from './reminders';

/*
 * v3 Block E: the sender's decisions, tested here rather than in Deno.
 *
 * `reminders.ts` has no imports for exactly this reason — the code that decides
 * who gets what runs the same on Node as it does on Supabase, so it can be
 * tested by `npm test` alongside everything else. What can't be tested here is
 * in `index.ts`: reading secrets, talking to the database, and the encryption,
 * which the `web-push` library does.
 */

const device = (user: string, endpoint: string): Device => ({
  user_id: user,
  endpoint,
  p256dh: 'p256dh-value',
  auth: 'auth-value',
});

const due = (user: string, unfinished: number): DueReminder => ({
  user_id: user,
  local_date: '2026-09-22',
  unfinished,
});

/** A sender that records what it was asked to do and answers as told. */
function recorder(answers: Record<string, SendOutcome> = {}) {
  const calls: { endpoint: string; notification: Notification }[] = [];
  return {
    calls,
    send: async (target: Device, notification: Notification) => {
      calls.push({ endpoint: target.endpoint, notification });
      return answers[target.endpoint] ?? ({ ok: true } as SendOutcome);
    },
  };
}

describe('what the notification says', () => {
  it('V3E-01 · counts what is left, and says it in plain words', () => {
    // One tag for the daily nudge, so a week of unread ones stays one line.
    expect(reminderNotification(1)).toEqual({ title: 'Habibit', body: '1 habit left today.', tag: 'habibit-reminder' });
    expect(reminderNotification(3)).toEqual({ title: 'Habibit', body: '3 habits left today.', tag: 'habibit-reminder' });
  });

  it('V3E-02 · ⭐ says a count and nothing else, whatever the count', () => {
    // A notification sits on a lock screen where anyone can read it, so the
    // body is a number and fixed words — never a habit's name. This is the
    // test that would go red if someone ever put one in.
    for (const count of [1, 2, 7, 42]) {
      expect(reminderNotification(count).body, String(count)).toMatch(/^\d+ habits? left today\.$/);
      expect(reminderNotification(count).title).toBe('Habibit');
    }
  });
});

describe('sending the round', () => {
  it('V3E-10 · ⭐ every device of every person due gets one, and only theirs', async () => {
    const devices = [device('alice', 'https://push/a1'), device('alice', 'https://push/a2'), device('bob', 'https://push/b1')];
    const sender = recorder();

    const report = await sendReminders([due('alice', 2), due('bob', 1)], devices, sender.send);

    expect(report.sent).toBe(3);
    expect(sender.calls.map((call) => call.endpoint).sort()).toEqual([
      'https://push/a1',
      'https://push/a2',
      'https://push/b1',
    ]);
    // Alice's count went to Alice's devices, and Bob's to Bob's.
    const bodies = new Map(sender.calls.map((call) => [call.endpoint, call.notification.body]));
    expect(bodies.get('https://push/a1')).toBe('2 habits left today.');
    expect(bodies.get('https://push/b1')).toBe('1 habit left today.');
  });

  it('V3E-11 · ⭐ someone who is not due is not sent to', async () => {
    const sender = recorder();

    await sendReminders([due('alice', 1)], [device('alice', 'https://push/a1'), device('carol', 'https://push/c1')], sender.send);

    expect(sender.calls.map((call) => call.endpoint)).toEqual(['https://push/a1']);
  });

  it('V3E-12 · ⭐ one failing device does not cost anyone else their reminder', async () => {
    const devices = [device('alice', 'https://push/a1'), device('bob', 'https://push/b1'), device('carol', 'https://push/c1')];
    const sender = recorder({ 'https://push/b1': { ok: false, gone: false } });

    const report = await sendReminders([due('alice', 1), due('bob', 1), due('carol', 1)], devices, sender.send);

    expect(report.sent).toBe(2);
    expect(report.failed).toBe(1);
    expect(sender.calls).toHaveLength(3);
  });

  it('V3E-13 · ⭐ a send that throws is a failure, not the end of the run', async () => {
    // Nobody is watching a scheduled job, so there is nobody for an exception
    // to reach. The other devices still get theirs.
    const devices = [device('alice', 'https://push/a1'), device('bob', 'https://push/b1')];
    const send = async (target: Device) => {
      if (target.endpoint === 'https://push/a1') throw new Error('socket closed');
      return { ok: true } as SendOutcome;
    };

    const report = await sendReminders([due('alice', 1), due('bob', 1)], devices, send);

    expect(report).toMatchObject({ sent: 1, failed: 1, gone: [] });
  });

  it('V3E-14 · ⭐ a device the push service says is gone is handed back for deleting', async () => {
    const devices = [device('alice', 'https://push/dead'), device('alice', 'https://push/alive')];
    const sender = recorder({ 'https://push/dead': { ok: false, gone: true } });

    const report = await sendReminders([due('alice', 1)], devices, sender.send);

    expect(report.gone.map((d) => d.endpoint)).toEqual(['https://push/dead']);
    expect(report.sent).toBe(1);
  });

  it('V3E-15 · a device that merely failed is kept, not deleted', async () => {
    // A push service having a bad minute must not cost you your phone.
    const sender = recorder({ 'https://push/a1': { ok: false, gone: false } });

    const report = await sendReminders([due('alice', 1)], [device('alice', 'https://push/a1')], sender.send);

    expect(report.gone).toEqual([]);
    expect(report.failed).toBe(1);
  });

  it('V3E-16 · someone due with no device left is counted, not sent to', async () => {
    const sender = recorder();

    const report = await sendReminders([due('alice', 1)], [], sender.send);

    expect(report).toMatchObject({ sent: 0, failed: 0, unreachable: ['alice'] });
    expect(sender.calls).toEqual([]);
  });

  it('V3E-17 · ⭐ the devices are all attempted together, not one after another', async () => {
    // Twenty devices behind one slow push service should take as long as the
    // slowest, not the sum. Each send here waits for a gate that only opens
    // once every send has started.
    let started = 0;
    let open = () => {};
    const gate = new Promise<void>((resolve) => (open = resolve));
    const devices = ['a', 'b', 'c'].map((name) => device(name, `https://push/${name}`));

    const send = async () => {
      started += 1;
      if (started === devices.length) open();
      await gate;
      return { ok: true } as SendOutcome;
    };

    const report = await sendReminders(devices.map((d) => due(d.user_id, 1)), devices, send);

    expect(report.sent).toBe(3);
  });
});

describe('the rest', () => {
  it('V3E-20 · only the two "this address is dead" replies count as gone', () => {
    expect(isGone(404)).toBe(true);
    expect(isGone(410)).toBe(true);
    for (const status of [200, 201, 400, 401, 403, 429, 500, 502, 503]) {
      expect(isGone(status), String(status)).toBe(false);
    }
  });

  it('V3E-21 · ⭐ only the secret key may run the sender', () => {
    expect(isAuthorised('Bearer secret-value', 'secret-value')).toBe(true);
    expect(isAuthorised('secret-value', 'secret-value')).toBe(true);
    // The key the app ships in every browser is a valid key, and not this one.
    expect(isAuthorised('Bearer publishable-value', 'secret-value')).toBe(false);
    expect(isAuthorised(null, 'secret-value')).toBe(false);
    expect(isAuthorised('Bearer ', 'secret-value')).toBe(false);
  });

  it('V3E-22 · ⭐ a sender with no secret configured lets nobody in', () => {
    // Otherwise a missing secret would turn into "no check at all", which is
    // the worst way for a configuration mistake to fail.
    expect(isAuthorised('Bearer anything', undefined)).toBe(false);
    expect(isAuthorised('Bearer ', '')).toBe(false);
    expect(isAuthorised(null, '')).toBe(false);
  });
});


/*
 * v4 Block F: the per-habit reminders.
 *
 * The decision this block has to keep is Block E's: a habit's name reaches a
 * lock screen only when that habit was told it may.
 */

const habitDue = (user: string, overrides: Partial<DueHabitReminder> = {}): DueHabitReminder => ({
  user_id: user,
  habit_id: 'h1',
  title: 'Take medication',
  say_name: false,
  local_date: '2026-10-02',
  ...overrides,
});

describe('what a per-habit reminder says', () => {
  it('V4F-01 · ⭐ says nothing about the habit unless that habit said it may', () => {
    expect(habitReminderNotification(habitDue('u1'))).toEqual({
      title: 'Habibit',
      body: 'Time for one of your habits.',
      // Its own tag, so two habits due at once don't collapse into one.
      tag: 'habibit-habit:h1',
    });
  });

  it('V4F-02 · ⭐ names it when it may', () => {
    expect(habitReminderNotification(habitDue('u1', { say_name: true }))).toEqual({
      title: 'Habibit',
      body: 'Time for Take medication.',
      tag: 'habibit-habit:h1',
    });
  });

  it('V4F-03 · a very long name is cut, not spilled across the lock screen', () => {
    const long = habitReminderNotification(habitDue('u1', { say_name: true, title: 'x'.repeat(200) }));
    expect(long.body.length).toBeLessThanOrEqual(80);
  });

  it('V4F-04 · a title that is only spaces falls back rather than saying "Time for ."', () => {
    expect(habitReminderNotification(habitDue('u1', { say_name: true, title: '   ' })).body).toBe(
      'Time for one of your habits.',
    );
  });
});

describe('sending the per-habit reminders', () => {
  it('V4F-05 · ⭐ every device of the person gets it', async () => {
    const recording = recorder();
    const devices = [device('u1', 'https://push/a'), device('u1', 'https://push/b')];

    const report = await sendHabitReminders([habitDue('u1', { say_name: true })], devices, recording.send);

    expect(report).toMatchObject({ sent: 2, failed: 0 });
    expect(recording.calls.map((c) => c.notification.body)).toEqual([
      'Time for Take medication.',
      'Time for Take medication.',
    ]);
  });

  it('V4F-06 · ⭐ two habits due at once are two notifications, each with its own wording', async () => {
    const recording = recorder();
    const due = [
      habitDue('u1', { habit_id: 'h1', title: 'Take medication', say_name: true }),
      habitDue('u1', { habit_id: 'h2', title: 'Stretch', say_name: false }),
    ];

    await sendHabitReminders(due, [device('u1', 'https://push/a')], recording.send);

    expect(recording.calls.map((c) => c.notification.body)).toEqual([
      'Time for Take medication.',
      'Time for one of your habits.',
    ]);
  });

  it('V4F-07 · ⭐ one device failing does not stop anybody else', async () => {
    const recording = recorder({ 'https://push/broken': { ok: false, gone: false } });
    const devices = [device('u1', 'https://push/broken'), device('u2', 'https://push/fine')];

    const report = await sendHabitReminders([habitDue('u1'), habitDue('u2')], devices, recording.send);

    expect(report).toMatchObject({ sent: 1, failed: 1 });
    expect(recording.calls).toHaveLength(2);
  });

  it('V4F-08 · ⭐ a send that throws is a failure, not the end of the run', async () => {
    const devices = [device('u1', 'https://push/throws'), device('u2', 'https://push/fine')];
    const send = async (target: Device) => {
      if (target.endpoint.endsWith('throws')) throw new Error('push service exploded');
      return { ok: true } as SendOutcome;
    };

    await expect(sendHabitReminders([habitDue('u1'), habitDue('u2')], devices, send)).resolves.toMatchObject({
      sent: 1,
      failed: 1,
    });
  });

  it('V4F-09 · a dead address is reported for deleting, and somebody with no device is reported too', async () => {
    const recording = recorder({ 'https://push/dead': { ok: false, gone: true } });

    const report = await sendHabitReminders(
      [habitDue('u1'), habitDue('u2')],
      [device('u1', 'https://push/dead')],
      recording.send,
    );

    expect(report.gone.map((d) => d.endpoint)).toEqual(['https://push/dead']);
    expect(report.unreachable).toEqual(['u2']);
  });
});