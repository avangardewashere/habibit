'use client';

import { getSupabase } from '@/lib/supabase/client';
import type { DeviceSubscription } from './push';
import { DEFAULT_REMINDER_TIME, deviceTimezone, toReminderTime } from './times';

/**
 * The account's half of a reminder: what you asked for, and which devices should
 * get it. Every row here belongs to one person, and the database refuses to show
 * or change anyone else's (supabase/migrations/20260921000000_reminders.sql).
 */

export type ReminderSettings = {
  enabled: boolean;
  /** "HH:MM" on a 24-hour clock. */
  time: string;
  /** IANA zone, e.g. "Asia/Manila". */
  timezone: string;
};

/** Turns a throw into the same `{ data, error }` shape Supabase normally answers with. */
async function attempt<T>(query: () => PromiseLike<{ data: T; error: unknown }>): Promise<{ data: T | null; error: unknown }> {
  try {
    return await query();
  } catch (error) {
    return { data: null, error: error ?? new Error('query failed') };
  }
}

export const REMINDERS_OFF: ReminderSettings = {
  enabled: false,
  time: DEFAULT_REMINDER_TIME,
  timezone: 'UTC',
};

/**
 * What the account holds, or `null` if it can't be read (signed out, no signal).
 *
 * Every call here is wrapped: these run inside an effect while the popup opens,
 * and a throw there becomes an unhandled rejection rather than a message on
 * screen. Supabase reports most problems as an `error` value, but not all of
 * them (found by CI in v3 Block D).
 */
export async function loadReminderSettings(): Promise<ReminderSettings | null> {
  const supabase = getSupabase();
  if (!supabase) return null;

  const { data, error } = await attempt(() =>
    supabase.from('reminder_settings').select('enabled,local_time,timezone').maybeSingle(),
  );
  if (error) return null;
  // No row yet is not a failure: it means reminders have never been turned on.
  if (!data) return { ...REMINDERS_OFF, timezone: deviceTimezone() };

  return {
    enabled: data.enabled === true,
    time: toReminderTime(data.local_time),
    timezone: typeof data.timezone === 'string' ? data.timezone : deviceTimezone(),
  };
}

/** Writes the whole setting, so turning off and changing the time share one path. */
export async function saveReminderSettings(settings: ReminderSettings): Promise<boolean> {
  const supabase = getSupabase();
  if (!supabase) return false;

  const { error } = await attempt(() =>
    supabase.from('reminder_settings').upsert(
      {
        enabled: settings.enabled,
        local_time: settings.time,
        timezone: settings.timezone,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'user_id' },
    ),
  );
  return !error;
}

/**
 * Remembers this device. Repeating it is harmless: a browser hands back the same
 * address until it decides otherwise, and the row is keyed by it.
 */
export async function saveDevice(subscription: DeviceSubscription): Promise<boolean> {
  const supabase = getSupabase();
  if (!supabase) return false;

  const { error } = await attempt(() =>
    supabase.from('push_subscriptions').upsert(
      {
        endpoint: subscription.endpoint,
        p256dh: subscription.p256dh,
        auth: subscription.auth,
      },
      { onConflict: 'user_id,endpoint' },
    ),
  );
  return !error;
}

// ---------------------------------------------------------------------------
// One habit's own reminder (v4 Block E). As well as the daily nudge, never
// instead of it.
// ---------------------------------------------------------------------------

export type HabitReminder = {
  enabled: boolean;
  /** "HH:MM" on a 24-hour clock, on your own clock. */
  time: string;
  /**
   * Whether the notification may say which habit it is. **Off by default**:
   * v3's rule is that a lock screen is public, and this is the exception you
   * choose, habit by habit.
   */
  sayName: boolean;
};

export const HABIT_REMINDER_OFF: HabitReminder = {
  enabled: false,
  time: DEFAULT_REMINDER_TIME,
  sayName: false,
};

/** This habit's reminder, or `null` if it can't be read (signed out, no signal). */
export async function loadHabitReminder(habitId: string): Promise<HabitReminder | null> {
  const supabase = getSupabase();
  if (!supabase) return null;

  const { data, error } = await attempt(() =>
    supabase.from('habit_reminders').select('enabled,local_time,say_name').eq('habit_id', habitId).maybeSingle(),
  );
  if (error) return null;
  // No row is not a failure: this habit has never had a reminder.
  if (!data) return HABIT_REMINDER_OFF;

  return {
    enabled: data.enabled === true,
    time: toReminderTime(data.local_time),
    // Anything but a stored `true` is private, including a row from a build
    // that doesn't have this column yet.
    sayName: data.say_name === true,
  };
}

/**
 * Writes the whole reminder, so turning it off, moving the time and changing
 * the naming choice share one path.
 *
 * It also records which clock the time is on. That lives in the account's
 * reminder settings, one row per person, and only the timezone is written —
 * an upsert touches just the columns it sends, so switching on a habit's
 * reminder can never turn the daily nudge on or off by accident.
 */
export async function saveHabitReminder(habitId: string, reminder: HabitReminder): Promise<boolean> {
  const supabase = getSupabase();
  if (!supabase) return false;

  const { error: zoneError } = await attempt(() =>
    supabase
      .from('reminder_settings')
      .upsert({ timezone: deviceTimezone(), updated_at: new Date().toISOString() }, { onConflict: 'user_id' }),
  );
  if (zoneError) return false;

  const { error } = await attempt(() =>
    supabase.from('habit_reminders').upsert(
      {
        habit_id: habitId,
        enabled: reminder.enabled,
        local_time: reminder.time,
        say_name: reminder.sayName,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'user_id,habit_id' },
    ),
  );
  return !error;
}

/** Forgets one device. The others keep their reminders. */
export async function forgetDevice(endpoint: string): Promise<boolean> {
  const supabase = getSupabase();
  if (!supabase) return false;

  const { error } = await attempt(() => supabase.from('push_subscriptions').delete().eq('endpoint', endpoint));
  return !error;
}
