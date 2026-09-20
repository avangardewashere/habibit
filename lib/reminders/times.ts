/**
 * The times a reminder can be set to: every quarter hour of the day.
 *
 * Quarter hours, not minutes, because the sender (Block E) wakes up on the
 * quarter hour. Sixty choices would also be a worse thing to scroll on a phone.
 *
 * A time is stored as "HH:MM" on a 24-hour clock, which is what Postgres's
 * `time` column takes and gives back, and shown as "8:00 pm".
 */

export const DEFAULT_REMINDER_TIME = '20:00';

/** Every quarter hour, "00:00" to "23:45". */
export function reminderTimes(): string[] {
  const times: string[] = [];
  for (let hour = 0; hour < 24; hour += 1) {
    for (const minute of [0, 15, 30, 45]) {
      times.push(`${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`);
    }
  }
  return times;
}

export function isReminderTime(value: unknown): value is string {
  return typeof value === 'string' && /^([01]\d|2[0-3]):(00|15|30|45)$/.test(value);
}

/**
 * Postgres returns a `time` as "20:00:00"; the app stores "20:00". Anything
 * that isn't a quarter hour we can show — including a row written by a future
 * build — falls back to the default rather than breaking the picker.
 */
export function toReminderTime(value: unknown): string {
  if (typeof value !== 'string') return DEFAULT_REMINDER_TIME;
  const short = value.slice(0, 5);
  return isReminderTime(short) ? short : DEFAULT_REMINDER_TIME;
}

/** "20:00" → "8:00 pm". */
export function formatReminderTime(time: string): string {
  const [hour, minute] = time.split(':').map(Number);
  const suffix = hour < 12 ? 'am' : 'pm';
  const shown = hour % 12 === 0 ? 12 : hour % 12;
  return `${shown}:${String(minute).padStart(2, '0')} ${suffix}`;
}

/**
 * The zone this device is in, e.g. "Asia/Manila", so the server knows when
 * your 8 pm is. Falls back to UTC if the browser won't say.
 */
export function deviceTimezone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
  } catch {
    return 'UTC';
  }
}
