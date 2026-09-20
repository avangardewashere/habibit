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

/** Forgets one device. The others keep their reminders. */
export async function forgetDevice(endpoint: string): Promise<boolean> {
  const supabase = getSupabase();
  if (!supabase) return false;

  const { error } = await attempt(() => supabase.from('push_subscriptions').delete().eq('endpoint', endpoint));
  return !error;
}
