/*
 * The sending half of a daily reminder, with nothing runtime-specific in it.
 *
 * This file deliberately has **no imports**. It ships inside a Supabase Edge
 * Function, which runs on Deno; the repo's tests run on Node. Keeping the
 * decisions here — what the notification says, who gets it, what to do when a
 * device has gone away — means they can be tested by `npm test` like everything
 * else, while `index.ts` does the parts only Deno can do.
 *
 * Nothing in here knows what a VAPID key is. Sending is handed in.
 */

/** One person the database says is due, as `claim_due_reminders` returns them. */
export type DueReminder = {
  user_id: string;
  local_date: string;
  unfinished: number;
};

/** One registered browser, as `push_subscriptions` holds it. */
export type Device = {
  user_id: string;
  endpoint: string;
  p256dh: string;
  auth: string;
};

/**
 * What one attempt at one device came to.
 *
 * `gone` is the push service saying this address is dead — the browser threw
 * the subscription away, or was uninstalled. It is not a failure to retry; it
 * is a row to delete.
 */
export type SendOutcome = { ok: true } | { ok: false; gone: boolean };

/**
 * `tag` decides what a new notification replaces. The daily nudge keeps one,
 * so a week of unread ones is a single line rather than a column — but each
 * habit carries its own, or two habits due at eight o'clock would arrive as
 * one (public/sw.js).
 */
export type Notification = { title: string; body: string; tag: string };

export const DAILY_TAG = 'habibit-reminder';

/** Sends one notification to one device. Supplied by the caller. */
export type Send = (device: Device, notification: Notification) => Promise<SendOutcome>;

export type SendReport = {
  sent: number;
  failed: number;
  /** Devices the push service says no longer exist, for deleting. */
  gone: Device[];
  /** People who are due but have no device registered any more. */
  unreachable: string[];
};

/**
 * What the notification says.
 *
 * Deliberately plain, and never the habit's name: a notification sits on a lock
 * screen where anyone can read it, and "Take the medication" on a borrowed
 * phone is not ours to show. The count is enough to be worth tapping.
 */
export function reminderNotification(unfinished: number): Notification {
  return {
    title: 'Habibit',
    body: unfinished === 1 ? '1 habit left today.' : `${unfinished} habits left today.`,
    tag: DAILY_TAG,
  };
}

/** One habit's reminder, as `claim_due_habit_reminders` returns it (v4 Block F). */
export type DueHabitReminder = {
  user_id: string;
  habit_id: string;
  title: string;
  say_name: boolean;
  local_date: string;
};

/** Long enough for any real habit; short enough not to fill a lock screen. */
export const LONGEST_SPOKEN_TITLE = 60;

/**
 * What a per-habit reminder says.
 *
 * The habit's name appears **only** when that habit was told it may. The
 * default is v3's rule — a lock screen is public, and someone else's glance is
 * not ours to give away — and `say_name` is the exception, chosen one habit at
 * a time (v4 Block E).
 *
 * Note what this function cannot do: it has no way to find a title except the
 * one handed to it, and it drops that title on the floor unless `say_name` is
 * true. There is no code path from "a habit exists" to "its name is on a lock
 * screen" that doesn't go through someone choosing it.
 */
export function habitReminderNotification(reminder: DueHabitReminder): Notification {
  // Its own tag, so two habits due at the same time are two notifications —
  // and tomorrow's reminder for *this* habit replaces today's unread one.
  const tag = `habibit-habit:${reminder.habit_id}`;
  if (!reminder.say_name) return { title: 'Habibit', body: 'Time for one of your habits.', tag };

  const name = reminder.title.trim().slice(0, LONGEST_SPOKEN_TITLE);
  // A title that is only spaces would leave "Time for ." on the screen.
  return { title: 'Habibit', body: name ? `Time for ${name}.` : 'Time for one of your habits.', tag };
}

/** Groups devices by who owns them, so each person's devices are found once. */
function devicesByUser(devices: readonly Device[]): Map<string, Device[]> {
  const byUser = new Map<string, Device[]>();
  for (const device of devices) {
    const list = byUser.get(device.user_id);
    if (list) list.push(device);
    else byUser.set(device.user_id, [device]);
  }
  return byUser;
}

/**
 * Sends one notification to every device of everyone due.
 *
 * Two rules, both about one bad row not spoiling the rest:
 *
 * - every device is attempted, whatever the others did. A push service that is
 *   having a bad morning must not cost everybody else their reminder, so the
 *   sends run together and each result is taken on its own;
 * - a send that throws counts as a failure, not as the end of the run. The
 *   caller is a scheduled job with nobody watching: there is no one to see an
 *   exception, so there is no point throwing one.
 */
export async function sendReminders(
  due: readonly DueReminder[],
  devices: readonly Device[],
  send: Send,
): Promise<SendReport> {
  return sendAll(
    due.map((person) => ({ user_id: person.user_id, notification: reminderNotification(person.unfinished) })),
    devices,
    send,
  );
}

/**
 * The same, for the per-habit reminders (v4 Block F).
 *
 * One person can be due for several at once — two habits at eight o'clock —
 * and each is its own notification, because collapsing them into "2 things to
 * do" is what the account-wide nudge already says.
 */
export async function sendHabitReminders(
  due: readonly DueHabitReminder[],
  devices: readonly Device[],
  send: Send,
): Promise<SendReport> {
  return sendAll(
    due.map((reminder) => ({ user_id: reminder.user_id, notification: habitReminderNotification(reminder) })),
    devices,
    send,
  );
}

/** One notification, addressed to everyone's devices, with nothing shared between them. */
async function sendAll(
  items: readonly { user_id: string; notification: Notification }[],
  devices: readonly Device[],
  send: Send,
): Promise<SendReport> {
  const byUser = devicesByUser(devices);
  const report: SendReport = { sent: 0, failed: 0, gone: [], unreachable: [] };

  const attempts: { device: Device; outcome: Promise<SendOutcome> }[] = [];

  for (const item of items) {
    const theirs = byUser.get(item.user_id) ?? [];
    if (theirs.length === 0) {
      report.unreachable.push(item.user_id);
      continue;
    }
    for (const device of theirs) {
      attempts.push({
        device,
        // Started here, awaited below: the sends overlap rather than queueing.
        outcome: send(device, item.notification).catch(() => ({ ok: false, gone: false }) as SendOutcome),
      });
    }
  }

  for (const attempt of attempts) {
    const outcome = await attempt.outcome;
    if (outcome.ok) report.sent += 1;
    else {
      report.failed += 1;
      if (outcome.gone) report.gone.push(attempt.device);
    }
  }

  return report;
}

/**
 * Whether a push service's reply means "this address is dead".
 *
 * 404 and 410 are the two the standard gives for a subscription that no longer
 * exists. Everything else — a timeout, a 500, a rate limit — is this push
 * service having a bad minute, and the row stays.
 */
export function isGone(status: number): boolean {
  return status === 404 || status === 410;
}

/**
 * Whether a caller may run the sender.
 *
 * Supabase checks that a caller holds *a* valid key before the function runs,
 * but the key the app ships in every browser is one of those. This is the check
 * that the caller holds the secret one, which only the scheduler inside
 * Supabase does.
 *
 * The comparison is length-first and then whole-string, and both are done on
 * values this function was handed — there is no key written down here.
 */
export function isAuthorised(header: string | null, secret: string | undefined): boolean {
  if (!secret) return false;
  const offered = (header ?? '').replace(/^Bearer\s+/i, '');
  return offered.length === secret.length && offered === secret;
}
