'use client';

import { useEffect, useState } from 'react';
import { useAccount } from '@/lib/auth/session';
import { notificationPermission, pushSupported, reminderKey, subscribeThisDevice } from '@/lib/reminders/push';
import {
  HABIT_REMINDER_OFF,
  loadHabitReminder,
  saveDevice,
  saveHabitReminder,
  type HabitReminder as Reminder,
} from '@/lib/reminders/store';
import { formatReminderTime, reminderTimes } from '@/lib/reminders/times';
import { useSync } from '@/store/SyncProvider';

/**
 * "Remind me" for one habit (v4 Block E).
 *
 * As well as v3's daily nudge, never instead of it: that one asks "is anything
 * left today?", this one is "tell me about *this* at this time".
 *
 * Reminders need an account, because the sending happens on a server that has
 * to know what you've already done — and they need this device registered, so
 * turning one on does both, exactly as the account-wide switch does.
 *
 * **Whether the notification names the habit is yours to choose, and off by
 * default.** v3's rule was that a notification never names a habit, because a
 * lock screen is public. This is the exception, taken one habit at a time:
 * "Time to take your medication" is worth having, and nobody's whole list
 * should become visible to get it.
 */
export function HabitReminder({ habitId, habitTitle }: { habitId: string; habitTitle: string }) {
  const account = useAccount();
  const { syncNow } = useSync();
  const [reminder, setReminder] = useState<Reminder | null>(null);
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);

  const signedIn = account.status === 'signed-in';

  useEffect(() => {
    if (!signedIn) return;
    let cancelled = false;
    (async () => {
      const stored = await loadHabitReminder(habitId);
      if (!cancelled) setReminder(stored ?? HABIT_REMINDER_OFF);
    })();
    return () => {
      cancelled = true;
    };
  }, [habitId, signedIn]);

  // A build with no key has no reminders at all, so there is nothing to offer.
  if (!reminderKey()) return null;

  if (!pushSupported()) return <Note>This browser can’t show reminders.</Note>;
  if (!signedIn) return <Note>Reminders need an account — sign in from the person icon at the top.</Note>;
  if (notificationPermission() === 'denied') {
    return <Note>Notifications are blocked for Habibit. Your browser’s settings for this site can turn them back on.</Note>;
  }
  if (!reminder) return <Note>Checking…</Note>;

  async function apply(next: Reminder, { subscribe = false } = {}) {
    const previous = reminder!;
    setBusy(true);
    setProblem(null);

    /*
     * The account has to know the habit before it can hold a reminder for it:
     * the reminder's row points at the habit's, and the database enforces that.
     * A habit added a moment ago is still in the outbox — edits go up 1.5
     * seconds after the last one — so turning its reminder on straight away
     * would be refused. Found by the browser test, not by reading the code.
     */
    if (next.enabled && !previous.enabled) await syncNow();

    if (subscribe) {
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
      if (!(await saveDevice(result.subscription))) {
        setBusy(false);
        setProblem('Couldn’t save this device. Check your connection and try again.');
        return;
      }
    }

    // Shown straight away, put back if the write fails: the same optimistic
    // path the rest of the app uses, and the only honest one offline.
    setReminder(next);
    const saved = await saveHabitReminder(habitId, next);
    setBusy(false);
    if (!saved) {
      setReminder(previous);
      setProblem('Couldn’t save that. Check your connection and try again.');
    }
  }

  return (
    <div className="mt-5 rounded-card border border-line bg-card p-4">
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs font-bold uppercase tracking-wide text-ink-soft">Remind me</p>
        <button
          type="button"
          onClick={() => void apply({ ...reminder, enabled: !reminder.enabled }, { subscribe: !reminder.enabled })}
          disabled={busy}
          aria-pressed={reminder.enabled}
          aria-label={`Remind me about ${habitTitle}`}
          className="min-h-11 touch-manipulation rounded-full border border-ink-soft px-3 text-xs font-extrabold text-ink transition active:scale-95 disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
        >
          {busy ? 'Saving…' : reminder.enabled ? 'Turn off' : 'Turn on'}
        </button>
      </div>

      {reminder.enabled ? (
        <>
          <label className="mt-2 flex items-center justify-between gap-2 text-sm text-ink">
            <span>At</span>
            <select
              value={reminder.time}
              onChange={(event) => void apply({ ...reminder, time: event.target.value })}
              aria-label={`Time to remind you about ${habitTitle}`}
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

          <div className="mt-2 flex items-center justify-between gap-2">
            <span className="text-sm text-ink">Say the habit’s name</span>
            <button
              type="button"
              onClick={() => void apply({ ...reminder, sayName: !reminder.sayName })}
              disabled={busy}
              aria-pressed={reminder.sayName}
              aria-label={`Say “${habitTitle}” in the reminder`}
              className={[
                'min-h-11 touch-manipulation rounded-full border px-3 text-xs font-extrabold transition active:scale-95 disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent',
                reminder.sayName
                  ? 'border-badge-done-bg bg-badge-done-bg text-badge-done-fg'
                  : 'border-ink-soft bg-card text-ink',
              ].join(' ')}
            >
              {reminder.sayName ? 'On' : 'Off'}
            </button>
          </div>

          <p className="mt-1 text-sm text-ink-soft">
            {reminder.sayName
              ? `Your lock screen will show “${habitTitle}”.`
              : 'Your lock screen will only say Habibit — not which habit.'}
          </p>
        </>
      ) : (
        <p className="mt-1 text-sm text-ink-soft">
          A nudge for this one habit, at a time you pick. The daily one carries on either way.
        </p>
      )}

      {problem && (
        <p role="alert" className="mt-2 text-sm text-danger">
          {problem}
        </p>
      )}
    </div>
  );
}

function Note({ children }: { children: React.ReactNode }) {
  return (
    <div className="mt-5 rounded-card border border-line bg-card p-4">
      <p className="text-xs font-bold uppercase tracking-wide text-ink-soft">Remind me</p>
      <p className="mt-1 text-sm text-ink-soft">{children}</p>
    </div>
  );
}
