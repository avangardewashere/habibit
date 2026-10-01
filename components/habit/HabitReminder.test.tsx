// @vitest-environment jsdom
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { HabitReminder as Reminder } from '@/lib/reminders/store';

/*
 * v4 Block E: "Remind me", for one habit.
 *
 * The decision this block exists to make: a reminder may say which habit it
 * is, and **only if you say so for that habit**. v3's rule was that a lock
 * screen is public and a notification never names a habit; everything here
 * guards the exception without weakening the default.
 */

const fake = vi.hoisted(() => ({
  key: 'test-key' as string | null,
  supported: true,
  permission: 'granted' as NotificationPermission | 'unsupported',
  account: { status: 'signed-in', email: 'you@example.com' } as { status: string; email?: string },
  stored: { enabled: false, time: '20:00', sayName: false } as Reminder | null,
  subscribeResult: { ok: true, subscription: { endpoint: 'https://push.example/abc', p256dh: 'p', auth: 'a' } } as
    | { ok: true; subscription: { endpoint: string; p256dh: string; auth: string } }
    | { ok: false; reason: string },
  saveOk: true,
  saved: [] as Reminder[],
  savedDevices: 0,
}));

vi.mock('@/lib/auth/session', () => ({ useAccount: () => fake.account }));

vi.mock('@/lib/reminders/push', () => ({
  reminderKey: () => fake.key,
  pushSupported: () => fake.supported,
  notificationPermission: () => fake.permission,
  subscribeThisDevice: async () => fake.subscribeResult,
}));

vi.mock('@/lib/reminders/store', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/reminders/store')>();
  return {
    ...actual,
    loadHabitReminder: async () => fake.stored,
    saveHabitReminder: async (_id: string, reminder: Reminder) => {
      if (!fake.saveOk) return false;
      fake.saved.push(reminder);
      return true;
    },
    saveDevice: async () => {
      fake.savedDevices += 1;
      return true;
    },
  };
});

import { HabitReminder } from './HabitReminder';

const turnOn = () => screen.getByRole('button', { name: 'Remind me about Take medication' });
const naming = () => screen.getByRole('button', { name: 'Say “Take medication” in the reminder' });
const last = () => fake.saved.at(-1)!;

async function show() {
  render(<HabitReminder habitId="h1" habitTitle="Take medication" />);
  await waitFor(() => expect(screen.queryByText('Checking…')).not.toBeInTheDocument());
}

beforeEach(() => {
  fake.key = 'test-key';
  fake.supported = true;
  fake.permission = 'granted';
  fake.account = { status: 'signed-in', email: 'you@example.com' };
  fake.stored = { enabled: false, time: '20:00', sayName: false };
  fake.subscribeResult = { ok: true, subscription: { endpoint: 'https://push.example/abc', p256dh: 'p', auth: 'a' } };
  fake.saveOk = true;
  fake.saved = [];
  fake.savedDevices = 0;
});

describe('a reminder for one habit', () => {
  it('V4E-01 · ⭐ starts off, and says the daily nudge is unaffected', async () => {
    await show();

    expect(turnOn()).toHaveAttribute('aria-pressed', 'false');
    expect(screen.getByText(/The daily one carries on either way/)).toBeVisible();
    expect(screen.queryByRole('combobox')).toBeNull();
  });

  it('V4E-02 · ⭐ turning it on registers this device and saves the reminder', async () => {
    await show();

    fireEvent.click(turnOn());

    await waitFor(() => expect(fake.saved).toHaveLength(1));
    expect(fake.savedDevices).toBe(1);
    expect(last()).toEqual({ enabled: true, time: '20:00', sayName: false });
  });

  it('V4E-03 · ⭐ naming the habit is off by default, and saying so is explicit', async () => {
    // The v3 promise: a lock screen shows "Habibit" and nothing about you.
    fake.stored = { enabled: true, time: '08:00', sayName: false };
    await show();

    expect(naming()).toHaveAttribute('aria-pressed', 'false');
    expect(screen.getByText(/only say Habibit — not which habit/)).toBeVisible();

    fireEvent.click(naming());

    await waitFor(() => expect(last().sayName).toBe(true));
    expect(await screen.findByText('Your lock screen will show “Take medication”.')).toBeVisible();
  });

  it('V4E-04 · ⭐ turning it off keeps the time and the naming choice', async () => {
    fake.stored = { enabled: true, time: '08:15', sayName: true };
    await show();

    fireEvent.click(turnOn());

    await waitFor(() => expect(last()).toEqual({ enabled: false, time: '08:15', sayName: true }));
  });

  it('V4E-05 · the time can be changed, and only quarter hours are offered', async () => {
    fake.stored = { enabled: true, time: '20:00', sayName: false };
    await show();

    const picker = screen.getByRole('combobox');
    expect(picker.querySelectorAll('option')).toHaveLength(96);
    fireEvent.change(picker, { target: { value: '07:45' } });

    await waitFor(() => expect(last().time).toBe('07:45'));
  });

  it('V4E-06 · ⭐ a write that fails puts the switch back, and says so', async () => {
    fake.saveOk = false;
    await show();

    fireEvent.click(turnOn());

    expect(await screen.findByRole('alert')).toHaveTextContent('Couldn’t save that');
    expect(turnOn()).toHaveAttribute('aria-pressed', 'false');
  });

  it('V4E-07 · ⭐ refusing notification permission saves nothing at all', async () => {
    fake.subscribeResult = { ok: false, reason: 'dismissed' };
    await show();

    fireEvent.click(turnOn());

    expect(await screen.findByRole('alert')).toHaveTextContent('Notifications need your permission');
    expect(fake.saved).toEqual([]);
    expect(turnOn()).toHaveAttribute('aria-pressed', 'false');
  });

  it('V4E-08 · signed out, it explains rather than offering a switch', async () => {
    fake.account = { status: 'signed-out' };
    render(<HabitReminder habitId="h1" habitTitle="Take medication" />);

    expect(screen.getByText(/Reminders need an account/)).toBeVisible();
    expect(screen.queryByRole('button')).toBeNull();
  });

  it('V4E-09 · with notifications blocked, or no key in the build, it does not pretend', async () => {
    fake.permission = 'denied';
    const blocked = render(<HabitReminder habitId="h1" habitTitle="Take medication" />);
    expect(screen.getByText(/Notifications are blocked/)).toBeVisible();
    blocked.unmount();

    fake.key = null;
    const { container } = render(<HabitReminder habitId="h1" habitTitle="Take medication" />);
    expect(container).toBeEmptyDOMElement();
  });
});
