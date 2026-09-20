import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

/*
 * The real public/sw.js, run with a stand-in for the worker it normally lives
 * in. A service worker can't be imported (it isn't a module and has no exports),
 * so the file is read and run against a fake `self` that records what it was
 * asked to show.
 *
 * This is the only way to exercise these rules outside CI: a real push needs a
 * real push service.
 */

type Shown = { title: string; options: Record<string, unknown> };

function loadWorker() {
  const source = readFileSync(new URL('../../public/sw.js', import.meta.url), 'utf8');

  const listeners = new Map<string, (event: unknown) => void>();
  const shown: Shown[] = [];
  const focused: string[] = [];
  const opened: string[] = [];
  const navigated: string[] = [];
  let windows: { url: string }[] = [];

  const self = {
    location: { origin: 'https://habibit.vercel.app' },
    addEventListener: (type: string, handler: (event: unknown) => void) => listeners.set(type, handler),
    registration: {
      showNotification: (title: string, options: Record<string, unknown>) => {
        shown.push({ title, options });
        return Promise.resolve();
      },
    },
    clients: {
      matchAll: async () => windows.map((w) => ({
        url: w.url,
        focus: async () => void focused.push(w.url),
        navigate: async (to: string) => void navigated.push(to),
      })),
      openWindow: async (url: string) => void opened.push(url),
      claim: async () => {},
    },
    skipWaiting: () => {},
  };

  // `caches` is only touched by the offline rules, which this file doesn't exercise.
  const caches = { open: async () => ({ add: async () => {}, match: async () => undefined }), keys: async () => [] };
  new Function('self', 'caches', source)(self, caches);

  /** Runs a listener and waits for whatever it passed to waitUntil. */
  async function fire(type: string, event: Record<string, unknown>) {
    let waited: Promise<unknown> = Promise.resolve();
    listeners.get(type)?.({ ...event, waitUntil: (promise: Promise<unknown>) => (waited = promise) });
    await waited;
  }

  return {
    fire,
    shown,
    focused,
    opened,
    navigated,
    setWindows: (urls: string[]) => (windows = urls.map((url) => ({ url }))),
  };
}

const push = (payload: unknown) => ({ data: { json: () => payload } });

describe('a reminder arriving at the service worker', () => {
  it('V3D-20 · ⭐ shows what the sender wrote', async () => {
    const worker = loadWorker();

    await worker.fire('push', push({ title: 'Habibit', body: '2 habits left today' }));

    expect(worker.shown).toHaveLength(1);
    expect(worker.shown[0].title).toBe('Habibit');
    expect(worker.shown[0].options.body).toBe('2 habits left today');
    // One tag, so a week of unopened reminders is one notification, not seven.
    expect(worker.shown[0].options.tag).toBe('habibit-reminder');
  });

  it('V3D-21 · ⭐ still shows something when the message is missing or unreadable', async () => {
    const worker = loadWorker();

    await worker.fire('push', { data: { json: () => { throw new Error('not json'); } } });
    await worker.fire('push', {});
    await worker.fire('push', push({ title: '', body: '' }));

    // A browser requires every push to show something; three pushes, three notifications.
    expect(worker.shown).toHaveLength(3);
    for (const shown of worker.shown) {
      expect(shown.title).toBe('Habibit');
      expect(String(shown.options.body).length).toBeGreaterThan(0);
    }
  });

  it('V3D-22 · ⭐ tapping it brings the app forward when it is already open', async () => {
    const worker = loadWorker();
    worker.setWindows(['https://habibit.vercel.app/']);

    await worker.fire('notificationclick', {
      notification: { data: { url: '/' }, close: () => {} },
    });

    expect(worker.focused).toEqual(['https://habibit.vercel.app/']);
    expect(worker.opened).toEqual([]);
  });

  it('V3D-23 · tapping it opens the app when nothing is open', async () => {
    const worker = loadWorker();
    worker.setWindows([]);

    await worker.fire('notificationclick', {
      notification: { data: { url: '/' }, close: () => {} },
    });

    expect(worker.opened).toEqual(['https://habibit.vercel.app/']);
  });

  it('V3D-24 · a window on another page of the app is sent home', async () => {
    const worker = loadWorker();
    worker.setWindows(['https://habibit.vercel.app/auth/confirm']);

    await worker.fire('notificationclick', {
      notification: { data: { url: '/' }, close: () => {} },
    });

    expect(worker.focused).toEqual(['https://habibit.vercel.app/auth/confirm']);
    expect(worker.navigated).toEqual(['https://habibit.vercel.app/']);
  });
});
