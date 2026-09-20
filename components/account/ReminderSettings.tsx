'use client';

import { useEffect, useState } from 'react';
import {
  currentSubscription,
  notificationPermission,
  pushSupported,
  reminderKey,
  subscribeThisDevice,
  unsubscribeThisDevice,
} from '@/lib/reminders/push';
import {
  forgetDevice,
  loadReminderSettings,
  saveDevice,
  saveReminderSettings,
  REMINDERS_OFF,
  type ReminderSettings as Settings,
} from '@/lib/reminders/store';
import { deviceTimezone, formatReminderTime, reminderTimes } from '@/lib/reminders/times';

/**
 * "Daily reminder" in the account popup: on or off, and at what time.
 *
 * Reminders need an account, because the server has to know what you haven't
 * finished before it decides whether to bother you at all. They also need this
 * particular device to be registered, so the two are set together: the switch
 * turns the reminder on for the account *and* signs this device up for it.
 *
 * Sending is Block E. Nothing here sends anything.
 */
export function ReminderSettings() {
  const [settings, setSettings] = useState<Settings | null>(null);
  const [onThisDevice, setOnThisDevice] = useState(false);
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const [stored, subscription] = await Promise.all([loadReminderSettings(), currentSubscription()]);
      if (cancelled) return;
      setSettings(stored ?? { ...REMINDERS_OFF, timezone: deviceTimezone() });
      setOnThisDevice(subscription !== null);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // A build with no key has no reminders at all, exactly as a build with no
  // Supabase settings has no account button.
  if (!reminderKey()) return null;

  if (!pushSupported()) {
    return (
      <Section>
        <p className="text-sm text-ink-soft">This browser can’t show reminders.</p>
      </Section>
    );
  }

  if (notificationPermission() === 'denied') {
    return (
      <Section>
        <p className="text-sm text-ink-soft">
          Notifications are blocked for Habibit. Your browser’s settings for this site can turn them back on.
        </p>
      </Section>
    );
  }

  if (!settings) {
    return (
      <Section>
        <p className="text-sm text-ink-soft">Checking your reminder…</p>
      </Section>
    );
  }

  const on = settings.enabled && onThisDevice;

  async function turnOn(time = settings!.time) {
    setBusy(true);
    setProblem(null);

    const result = await subscribeThisDevice();
    if (!result.ok) {
      setBusy(false);
      setProblem(
        result.reason === 'blocked'
          ? 'Your browser is blocking notifications for Habibit. Its settings for this site can undo that.'
          : result.reason === 'dismissed'
            ? 'Notifications need your permission. Tap again when you’re ready.'
            : 'Couldn’t set up reminders on this device. Try again in a moment.',
      );
      return;
    }

    const next: Settings = { enabled: true, time, timezone: deviceTimezone() };
    const saved = (await saveDevice(result.subscription)) && (await saveReminderSettings(next));
    setBusy(false);
    if (!saved) {
      setProblem('Couldn’t save your reminder. Check your connection and try again.');
      return;
    }
    setSettings(next);
    setOnThisDevice(true);
  }

  async function turnOff() {
    setBusy(true);
    setProblem(null);

    const endpoint = await unsubscribeThisDevice();
    const next: Settings = { ...settings!, enabled: false };
    const saved = (await saveReminderSettings(next)) && (endpoint === null || (await forgetDevice(endpoint)));
    setBusy(false);
    if (!saved) {
      setProblem('Couldn’t save that. Check your connection and try again.');
      return;
    }
    setSettings(next);
    setOnThisDevice(false);
  }

  async function changeTime(time: string) {
    const previous = settings!;
    setSettings({ ...previous, time });
    setProblem(null);
    if (!(await saveReminderSettings({ ...previous, time, timezone: deviceTimezone() }))) {
      setSettings(previous);
      setProblem('Couldn’t save the new time. Check your connection and try again.');
    }
  }

  return (
    <Section>
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs font-bold uppercase tracking-wide text-ink-soft">Daily reminder</p>
        <button
          type="button"
          onClick={() => void (on ? turnOff() : turnOn())}
          disabled={busy}
          aria-pressed={on}
          className="min-h-11 touch-manipulation rounded-full border border-ink-soft px-3 text-xs font-extrabold text-ink transition active:scale-95 disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
        >
          {busy ? 'Saving…' : on ? 'Turn off' : 'Turn on'}
        </button>
      </div>

      {on ? (
        <>
          <label className="mt-2 flex items-center justify-between gap-2 text-sm text-ink">
            <span>Remind me at</span>
            <select
              value={settings.time}
              onChange={(event) => void changeTime(event.target.value)}
              /* text-base is 16px: below that, iOS Safari zooms on focus. */
              className="min-h-11 rounded-lg border border-line bg-surface px-2 text-base text-ink focus:border-accent"
            >
              {reminderTimes().map((time) => (
                <option key={time} value={time}>
                  {formatReminderTime(time)}
                </option>
              ))}
            </select>
          </label>
          <p className="mt-1 text-sm text-ink-soft">
            Only if something’s still unfinished. Nothing arrives on a day you’ve ticked everything.
          </p>
        </>
      ) : (
        <p className="mt-1 text-sm text-ink-soft">
          {settings.enabled
            ? 'On for your account, but not on this device yet.'
            : `A nudge at ${formatReminderTime(settings.time)}, only if something’s still unfinished.`}
        </p>
      )}

      {problem && (
        <p role="alert" className="mt-2 text-sm text-danger">
          {problem}
        </p>
      )}
    </Section>
  );
}

function Section({ children }: { children: React.ReactNode }) {
  return <div className="border-t border-line pt-3">{children}</div>;
}
