// @vitest-environment jsdom
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const fake = vi.hoisted(() => ({
  key: 'test-key' as string | null,
  supported: true,
  permission: 'default' as NotificationPermission | 'unsupported',
  subscribed: null as { endpoint: string; p256dh: string; auth: string } | null,
  subscribeResult: {
    ok: true,
    subscription: { endpoint: 'https://push.example/abc', p256dh: 'p', auth: 'a' },
  } as { ok: true; subscription: { endpoint: string; p256dh: string; auth: string } } | { ok: false; reason: string },
  settings: { enabled: false, time: '20:00', timezone: 'Asia/Manila' } as {
    enabled: boolean;
    time: string;
    timezone: string;
  } | null,
  saveSettingsOk: true,
  saveDeviceOk: true,
  saved: [] as unknown[],
  savedDevices: [] as unknown[],
  forgotten: [] as string[],
  unsubscribed: 0,
}));

vi.mock('@/lib/reminders/push', () => ({
  reminderKey: () => fake.key,
  pushSupported: () => fake.supported,
  notificationPermission: () => fake.permission,
  currentSubscription: async () => fake.subscribed,
  subscribeThisDevice: async () => fake.subscribeResult,
  unsubscribeThisDevice: async () => {
    fake.unsubscribed += 1;
    return fake.subscribed?.endpoint ?? null;
  },
}));

vi.mock('@/lib/reminders/store', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/reminders/store')>();
  return {
    ...actual,
    loadReminderSettings: async () => fake.settings,
    saveReminderSettings: async (settings: unknown) => {
      if (!fake.saveSettingsOk) return false;
      fake.saved.push(settings);
      return true;
    },
    saveDevice: async (device: unknown) => {
      if (!fake.saveDeviceOk) return false;
      fake.savedDevices.push(device);
      return true;
    },
    forgetDevice: async (endpoint: string) => {
      fake.forgotten.push(endpoint);
      return true;
    },
  };
});

import { ReminderSettings } from './ReminderSettings';

const turnOn = () => screen.getByRole('button', { name: 'Turn on' });
const timePicker = () => screen.getByRole('combobox');

async function show() {
  render(<ReminderSettings />);
  // The first paint is "Checking your reminder…" while the account is read.
  await waitFor(() => expect(screen.queryByText('Checking your reminder…')).not.toBeInTheDocument());
}

beforeEach(() => {
  Object.assign(fake, {
    key: 'test-key',
    supported: true,
    permission: 'default' as NotificationPermission,
    subscribed: null,
    subscribeResult: { ok: true, subscription: { endpoint: 'https://push.example/abc', p256dh: 'p', auth: 'a' } },
    settings: { enabled: false, time: '20:00', timezone: 'Asia/Manila' },
    saveSettingsOk: true,
    saveDeviceOk: true,
    saved: [],
    savedDevices: [],
    forgotten: [],
    unsubscribed: 0,
  });
});

describe('the reminder setting', () => {
  it('V3D-30 · starts off, and says what turning it on would do', async () => {
    await show();

    expect(screen.getByText('Daily reminder')).toBeInTheDocument();
    expect(turnOn()).toHaveAttribute('aria-pressed', 'false');
    expect(screen.getByText(/A nudge at 8:00 pm, only if something’s still unfinished\./)).toBeInTheDocument();
    expect(screen.queryByRole('combobox')).not.toBeInTheDocument();
  });

  it('V3D-31 · ⭐ turning it on registers this device and saves the time and timezone', async () => {
    await show();

    fireEvent.click(turnOn());

    await waitFor(() => expect(screen.getByRole('button', { name: 'Turn off' })).toBeInTheDocument());
    expect(fake.savedDevices).toEqual([{ endpoint: 'https://push.example/abc', p256dh: 'p', auth: 'a' }]);
    expect(fake.saved).toEqual([{ enabled: true, time: '20:00', timezone: 'Asia/Manila' }]);
    expect(timePicker()).toHaveValue('20:00');
    expect(screen.getByText(/Only if something’s still unfinished/)).toBeInTheDocument();
  });

  it('V3D-32 · ⭐ a blocked browser is explained, not argued with', async () => {
    fake.permission = 'denied';
    await show();

    expect(screen.getByText(/Notifications are blocked for Habibit/)).toBeInTheDocument();
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });

  it('V3D-33 · a browser that can’t do push says so plainly', async () => {
    fake.supported = false;
    await show();

    expect(screen.getByText('This browser can’t show reminders.')).toBeInTheDocument();
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });

  it('V3D-34 · ⭐ a build with no key shows nothing at all', async () => {
    fake.key = null;
    const { container } = render(<ReminderSettings />);
    await waitFor(() => expect(container).toBeEmptyDOMElement());
  });

  it('V3D-35 · ⭐ turning it off unregisters this device and turns the setting off', async () => {
    fake.settings = { enabled: true, time: '07:30', timezone: 'Asia/Manila' };
    fake.subscribed = { endpoint: 'https://push.example/here', p256dh: 'p', auth: 'a' };
    await show();

    fireEvent.click(screen.getByRole('button', { name: 'Turn off' }));

    await waitFor(() => expect(screen.getByRole('button', { name: 'Turn on' })).toBeInTheDocument());
    expect(fake.unsubscribed).toBe(1);
    expect(fake.forgotten).toEqual(['https://push.example/here']);
    expect(fake.saved).toEqual([{ enabled: false, time: '07:30', timezone: 'Asia/Manila' }]);
  });

  it('V3D-36 · ⭐ a time that could not be saved goes back, and says so', async () => {
    fake.settings = { enabled: true, time: '20:00', timezone: 'Asia/Manila' };
    fake.subscribed = { endpoint: 'https://push.example/here', p256dh: 'p', auth: 'a' };
    await show();

    fake.saveSettingsOk = false;
    fireEvent.change(timePicker(), { target: { value: '07:15' } });

    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent(/Couldn’t save the new time/));
    expect(timePicker()).toHaveValue('20:00');
  });

  it('changing the time saves it', async () => {
    fake.settings = { enabled: true, time: '20:00', timezone: 'Asia/Manila' };
    fake.subscribed = { endpoint: 'https://push.example/here', p256dh: 'p', auth: 'a' };
    await show();

    fireEvent.change(timePicker(), { target: { value: '07:15' } });

    await waitFor(() => expect(fake.saved).toHaveLength(1));
    expect(fake.saved[0]).toEqual({ enabled: true, time: '07:15', timezone: 'Asia/Manila' });
    expect(timePicker()).toHaveValue('07:15');
  });

  it('V3D-37 · on for the account but not this device says exactly that', async () => {
    fake.settings = { enabled: true, time: '20:00', timezone: 'Asia/Manila' };
    fake.subscribed = null;
    await show();

    expect(screen.getByText('On for your account, but not on this device yet.')).toBeInTheDocument();
    expect(turnOn()).toBeInTheDocument();
  });

  it('V3D-39 · ⭐ a device that registers but cannot be saved does not look switched on', async () => {
    // The browser said yes, the account could not be reached. Claiming success
    // here would promise a reminder that no server knows about.
    fake.saveDeviceOk = false;
    await show();

    fireEvent.click(turnOn());

    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent(/Couldn’t save your reminder/));
    expect(screen.getByRole('button', { name: 'Turn on' })).toHaveAttribute('aria-pressed', 'false');
    expect(screen.queryByRole('combobox')).not.toBeInTheDocument();
  });

  it('V3D-38 · a refused subscription is reported, and nothing is saved', async () => {
    fake.subscribeResult = { ok: false, reason: 'blocked' };
    await show();

    fireEvent.click(turnOn());

    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent(/blocking notifications/));
    expect(fake.saved).toEqual([]);
    expect(fake.savedDevices).toEqual([]);
  });
});
