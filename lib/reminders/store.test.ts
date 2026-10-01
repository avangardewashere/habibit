// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest';

const client = vi.hoisted(() => ({ value: null as unknown }));

vi.mock('@/lib/supabase/client', () => ({ getSupabase: () => client.value }));

import {
  forgetDevice,
  loadHabitReminder,
  loadReminderSettings,
  saveDevice,
  saveHabitReminder,
  saveReminderSettings,
} from './store';

const device = { endpoint: 'https://push.example/abc', p256dh: 'p', auth: 'a' };

beforeEach(() => {
  client.value = null;
});

describe('the account side of a reminder', () => {
  it('V3D-17 · ⭐ a client that throws is handled, not left as an unhandled rejection', async () => {
    /*
     * Found by CI in this block: these run inside an effect while the popup
     * opens, and a throw there never reaches the screen — it becomes an
     * unhandled rejection. Supabase reports most problems as an error value,
     * but a broken or half-built client throws.
     */
    client.value = {
      from: () => {
        throw new TypeError('supabase.from is not a function');
      },
    };

    await expect(loadReminderSettings()).resolves.toBeNull();
    await expect(saveReminderSettings({ enabled: true, time: '20:00', timezone: 'UTC' })).resolves.toBe(false);
    await expect(saveDevice(device)).resolves.toBe(false);
    await expect(forgetDevice(device.endpoint)).resolves.toBe(false);
  });

  it('V3D-18 · with no account at all, nothing is read or written', async () => {
    await expect(loadReminderSettings()).resolves.toBeNull();
    await expect(saveDevice(device)).resolves.toBe(false);
  });

  it('V3D-19 · no row yet reads as "off", not as a failure', async () => {
    client.value = {
      from: () => ({ select: () => ({ maybeSingle: async () => ({ data: null, error: null }) }) }),
    };

    await expect(loadReminderSettings()).resolves.toEqual({
      enabled: false,
      time: '20:00',
      // The suite runs pinned to UTC+8.
      timezone: 'Asia/Manila',
    });
  });

  it('reads a stored row, seconds and all', async () => {
    client.value = {
      from: () => ({
        select: () => ({
          maybeSingle: async () => ({
            data: { enabled: true, local_time: '07:15:00', timezone: 'Europe/London' },
            error: null,
          }),
        }),
      }),
    };

    await expect(loadReminderSettings()).resolves.toEqual({
      enabled: true,
      time: '07:15',
      timezone: 'Europe/London',
    });
  });
});


/*
 * v4 Block E: one habit's own reminder. What matters here is exactly what gets
 * written — in particular that switching a habit's reminder on cannot disturb
 * the account-wide daily nudge.
 */
describe('a reminder for one habit', () => {
  /** Records every table write, so the payloads can be read back. */
  function recordingClient() {
    const writes: { table: string; payload: Record<string, unknown>; onConflict?: string }[] = [];
    client.value = {
      from: (table: string) => ({
        upsert: async (payload: Record<string, unknown>, options?: { onConflict?: string }) => {
          writes.push({ table, payload, onConflict: options?.onConflict });
          return { data: null, error: null };
        },
        select: () => ({
          eq: () => ({ maybeSingle: async () => ({ data: null, error: null }) }),
        }),
      }),
    };
    return writes;
  }

  it('V4E-20 · ⭐ switching one on writes only the timezone to the daily nudge', async () => {
    // An upsert touches just the columns it sends. Sending nabled here would
    // turn the account-wide nudge on or off behind your back.
    const writes = recordingClient();

    await expect(saveHabitReminder('h1', { enabled: true, time: '08:00', sayName: false })).resolves.toBe(true);

    const settings = writes.find((w) => w.table === 'reminder_settings')!;
    expect(Object.keys(settings.payload).sort()).toEqual(['timezone', 'updated_at']);
    expect(settings.payload.timezone).toBe('Asia/Manila'); // the suite's pinned zone
  });

  it('V4E-21 · ⭐ the reminder row carries the habit, the time and the naming choice', async () => {
    const writes = recordingClient();

    await saveHabitReminder('h1', { enabled: true, time: '08:15', sayName: true });

    const reminder = writes.find((w) => w.table === 'habit_reminders')!;
    expect(reminder.payload).toMatchObject({
      habit_id: 'h1',
      enabled: true,
      local_time: '08:15',
      say_name: true,
    });
    expect(reminder.onConflict).toBe('user_id,habit_id');
  });

  it('V4E-22 · ⭐ a habit with no reminder row reads as off, and private', async () => {
    recordingClient();

    await expect(loadHabitReminder('h1')).resolves.toEqual({ enabled: false, time: '20:00', sayName: false });
  });

  it('V4E-24 · ⭐ a stored row that says nothing about naming is private', async () => {
    // A row written by a build without this column, or with a null in it. The
    // privacy promise can only be given up deliberately, never by absence.
    for (const row of [{ enabled: true, local_time: '08:00' }, { enabled: true, local_time: '08:00', say_name: null }]) {
      client.value = {
        from: () => ({ select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: row, error: null }) }) }) }),
      };

      await expect(loadHabitReminder('h1'), JSON.stringify(row)).resolves.toEqual({
        enabled: true,
        time: '08:00',
        sayName: false,
      });
    }
  });

  it('V4E-23 · with no account at all, nothing is read or written', async () => {
    await expect(loadHabitReminder('h1')).resolves.toBeNull();
    await expect(saveHabitReminder('h1', { enabled: true, time: '08:00', sayName: false })).resolves.toBe(false);
  });
});