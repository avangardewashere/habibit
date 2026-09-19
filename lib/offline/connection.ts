/**
 * Whether the browser thinks it has a connection.
 *
 * `navigator.onLine` only reports whether the device has a network at all, so it
 * can say "online" on café WiFi that never reaches the internet. That is exactly
 * why it is used for **wording**, never for deciding whether to try: the app
 * always tries, and a failure is what tells it something is wrong. This only
 * chooses between "you're offline" and "couldn't reach your account".
 */
export function isOnline(): boolean {
  if (typeof navigator === 'undefined') return true;
  return navigator.onLine !== false;
}
