// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest';

/*
 * Push has no place in jsdom, so the browser's side of it is built here: a
 * permission, a push manager, and a subscription that reports itself the way a
 * real one does.
 */

const KEY = 'BBQb9Zk0vJZ5o1UvJZ5o1UvJZ5o1UvJZ5o1UvJZ5o1UvJZ5o1UvJZ5o1UvJZ5o1UvJZ5o1UvJZ5o1UvJZ5o';

type Fake = {
  permission: NotificationPermission;
  asked: NotificationPermission;
  existing: unknown;
  subscribeCalls: { userVisibleOnly?: boolean; applicationServerKey?: unknown }[];
  subscribeThrows: boolean;
  unsubscribed: string[];
};

let fake: Fake;

function fakeSubscription(endpoint = 'https://push.example/abc') {
  return {
    endpoint,
    toJSON: () => ({ endpoint, keys: { p256dh: 'p256dh-value', auth: 'auth-value' } }),
    unsubscribe: async () => {
      fake.unsubscribed.push(endpoint);
      return true;
    },
  };
}

function install() {
  Object.defineProperty(window, 'Notification', {
    configurable: true,
    value: {
      get permission() {
        return fake.permission;
      },
      requestPermission: async () => {
        fake.permission = fake.asked;
        return fake.asked;
      },
    },
  });
  Object.defineProperty(window, 'PushManager', { configurable: true, value: class {} });
  Object.defineProperty(navigator, 'serviceWorker', {
    configurable: true,
    value: {
      ready: Promise.resolve({
        pushManager: {
          getSubscription: async () => fake.existing,
          subscribe: async (options: { userVisibleOnly?: boolean; applicationServerKey?: unknown }) => {
            fake.subscribeCalls.push(options);
            if (fake.subscribeThrows) throw new Error('no push service');
            return fakeSubscription();
          },
        },
      }),
    },
  });
}

async function load() {
  vi.resetModules();
  vi.stubEnv('NEXT_PUBLIC_VAPID_PUBLIC_KEY', KEY);
  return import('./push');
}

beforeEach(() => {
  fake = {
    permission: 'default',
    asked: 'granted',
    existing: null,
    subscribeCalls: [],
    subscribeThrows: false,
    unsubscribed: [],
  };
  install();
});

describe('registering this device', () => {
  it('V3D-10 · ⭐ asks permission, subscribes, and reports the address and keys', async () => {
    const { subscribeThisDevice } = await load();

    const result = await subscribeThisDevice();

    expect(result).toEqual({
      ok: true,
      subscription: { endpoint: 'https://push.example/abc', p256dh: 'p256dh-value', auth: 'auth-value' },
    });
    // Every browser requires this: a push may only be sent to show something.
    expect(fake.subscribeCalls[0].userVisibleOnly).toBe(true);
    expect(fake.subscribeCalls[0].applicationServerKey).toBeInstanceOf(Uint8Array);
  });

  it('V3D-11 · ⭐ a blocked browser is reported as blocked, and nothing is asked', async () => {
    fake.permission = 'denied';
    const { subscribeThisDevice } = await load();

    expect(await subscribeThisDevice()).toEqual({ ok: false, reason: 'blocked' });
    expect(fake.subscribeCalls).toEqual([]);
  });

  it('V3D-12 · a dismissed prompt is not a refusal: it can be asked again', async () => {
    fake.asked = 'default';
    const { subscribeThisDevice } = await load();

    expect(await subscribeThisDevice()).toEqual({ ok: false, reason: 'dismissed' });
    expect(fake.subscribeCalls).toEqual([]);
  });

  it('V3D-13 · reuses the address this device already has', async () => {
    fake.permission = 'granted';
    fake.existing = fakeSubscription('https://push.example/existing');
    const { subscribeThisDevice } = await load();

    const result = await subscribeThisDevice();

    expect(result.ok && result.subscription.endpoint).toBe('https://push.example/existing');
    expect(fake.subscribeCalls).toEqual([]);
  });

  it('V3D-14 · a push service that refuses is a failure, not a crash', async () => {
    fake.permission = 'granted';
    fake.subscribeThrows = true;
    const { subscribeThisDevice } = await load();

    expect(await subscribeThisDevice()).toEqual({ ok: false, reason: 'failed' });
  });

  it('V3D-15 · a build with no key has no reminders at all', async () => {
    vi.resetModules();
    vi.stubEnv('NEXT_PUBLIC_VAPID_PUBLIC_KEY', '');
    const { reminderKey, subscribeThisDevice } = await import('./push');

    expect(reminderKey()).toBeNull();
    expect(await subscribeThisDevice()).toEqual({ ok: false, reason: 'unsupported' });
    expect(fake.subscribeCalls).toEqual([]);
  });

  it('V3D-16 · turning off hands the address back to the browser', async () => {
    fake.permission = 'granted';
    fake.existing = fakeSubscription('https://push.example/going');
    const { unsubscribeThisDevice } = await load();

    expect(await unsubscribeThisDevice()).toBe('https://push.example/going');
    expect(fake.unsubscribed).toEqual(['https://push.example/going']);
  });

  it('turning off when this device was never registered is a no-op', async () => {
    const { unsubscribeThisDevice } = await load();
    expect(await unsubscribeThisDevice()).toBeNull();
  });
});
