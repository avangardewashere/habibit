'use client';

/**
 * Registering *this device* for reminders.
 *
 * A push subscription is an address the browser's own push service gives us,
 * plus two keys. A message sent to that address is encrypted with those keys,
 * so the service in the middle carries something it cannot read, and only this
 * device can open it.
 *
 * The VAPID public key identifies Habibit to that service. It is public by
 * design and shipped in the app. Its private half never leaves the server that
 * sends (Block E) — it is not in this file, this bundle, or Vercel.
 */

export type DeviceSubscription = {
  endpoint: string;
  p256dh: string;
  auth: string;
};

/**
 * Written out in full, not through a variable: Next only inlines
 * `process.env.NEXT_PUBLIC_*` into the browser bundle when it sees the literal.
 */
const vapidPublicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;

/** `null` when this build has no key, exactly as a build with no Supabase has no accounts. */
export function reminderKey(): string | null {
  return vapidPublicKey && vapidPublicKey.length > 0 ? vapidPublicKey : null;
}

/** Whether this browser can do push at all. Desktop Safari and old browsers can't. */
export function pushSupported(): boolean {
  return (
    typeof window !== 'undefined' &&
    'serviceWorker' in navigator &&
    'PushManager' in window &&
    'Notification' in window
  );
}

export function notificationPermission(): NotificationPermission | 'unsupported' {
  return pushSupported() ? Notification.permission : 'unsupported';
}

/** The key travels as base64url text and has to reach `subscribe` as bytes. */
function keyBytes(base64: string): Uint8Array<ArrayBuffer> {
  const padded = (base64 + '='.repeat((4 - (base64.length % 4)) % 4)).replace(/-/g, '+').replace(/_/g, '/');
  const raw = atob(padded);
  // Over its own ArrayBuffer: `subscribe` takes a BufferSource, and a plain
  // Uint8Array can be backed by a shared buffer, which that type refuses.
  const bytes = new Uint8Array(new ArrayBuffer(raw.length));
  for (let i = 0; i < raw.length; i += 1) bytes[i] = raw.charCodeAt(i);
  return bytes;
}

function toDeviceSubscription(subscription: PushSubscription): DeviceSubscription {
  // The browser hands the keys back as raw bytes; the database column is text.
  const json = subscription.toJSON();
  const keys = json.keys ?? {};
  return { endpoint: subscription.endpoint, p256dh: keys.p256dh ?? '', auth: keys.auth ?? '' };
}

/**
 * The worker this device's push subscription hangs off, or `null`.
 *
 * `navigator.serviceWorker.ready` never settles when registration failed —
 * Firefox's private windows refuse service workers while still offering the
 * API. Waiting on it forever would leave the popup on "Checking your reminder…"
 * with nothing to read and nothing to do, so the wait is capped: a browser with
 * no worker by then is one that cannot take a reminder.
 */
export const WORKER_WAIT_MS = 5_000;

function workerReady(): Promise<ServiceWorkerRegistration | null> {
  return Promise.race([
    navigator.serviceWorker.ready,
    new Promise<null>((resolve) => setTimeout(() => resolve(null), WORKER_WAIT_MS)),
  ]);
}

/** This device's existing subscription, if it already has one. */
export async function currentSubscription(): Promise<DeviceSubscription | null> {
  if (!pushSupported()) return null;
  const registration = await workerReady();
  if (!registration) return null;
  const subscription = await registration.pushManager.getSubscription();
  return subscription ? toDeviceSubscription(subscription) : null;
}

export type SubscribeResult =
  | { ok: true; subscription: DeviceSubscription }
  /** `blocked` means the browser itself is refusing; only its settings can undo that. */
  | { ok: false; reason: 'unsupported' | 'blocked' | 'dismissed' | 'failed' };

/**
 * Asks permission if it hasn't been given, then subscribes this device.
 *
 * Asking is deliberately tied to the button: browsers hold a prompt against a
 * site that asks out of nowhere, and so do people.
 */
export async function subscribeThisDevice(): Promise<SubscribeResult> {
  const key = reminderKey();
  if (!pushSupported() || !key) return { ok: false, reason: 'unsupported' };
  if (Notification.permission === 'denied') return { ok: false, reason: 'blocked' };

  if (Notification.permission !== 'granted') {
    const answer = await Notification.requestPermission();
    if (answer === 'denied') return { ok: false, reason: 'blocked' };
    // "default" means the prompt was dismissed without an answer: ask again next time.
    if (answer !== 'granted') return { ok: false, reason: 'dismissed' };
  }

  try {
    const registration = await workerReady();
    if (!registration) return { ok: false, reason: 'failed' };
    const subscription =
      (await registration.pushManager.getSubscription()) ??
      (await registration.pushManager.subscribe({
        // Required by every browser: a push may only be sent to show something.
        userVisibleOnly: true,
        applicationServerKey: keyBytes(key),
      }));
    return { ok: true, subscription: toDeviceSubscription(subscription) };
  } catch {
    return { ok: false, reason: 'failed' };
  }
}

/** Hands the address back to the browser. The account row is removed separately. */
export async function unsubscribeThisDevice(): Promise<string | null> {
  if (!pushSupported()) return null;
  try {
    const registration = await workerReady();
    const subscription = await registration?.pushManager.getSubscription();
    if (!subscription) return null;
    const { endpoint } = subscription;
    await subscription.unsubscribe();
    return endpoint;
  } catch {
    return null;
  }
}
