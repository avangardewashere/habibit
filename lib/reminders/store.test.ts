// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest';

const client = vi.hoisted(() => ({ value: null as unknown }));

vi.mock('@/lib/supabase/client', () => ({ getSupabase: () => client.value }));

import { forgetDevice, loadReminderSettings, saveDevice, saveReminderSettings } from './store';

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
