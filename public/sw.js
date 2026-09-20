/*
 * Habibit's service worker: the small script that makes the app open with no
 * connection. Hand-written on purpose (v2 Block F) — two rules and nothing else.
 *
 *   - **The page itself:** try the network, fall back to the last copy kept
 *     here. Online, you always get the newest deploy; offline, the app opens.
 *   - **The build files** under _next/static — the app's scripts, styles and
 *     fonts. Their names contain a hash of their contents, so a kept copy can
 *     never be the wrong one: serve it from here, fetch only what isn't here.
 *
 * Requests to anywhere but this site — Supabase above all — are not touched, so
 * nothing about anyone's account is ever stored in these caches.
 */

// Bumped when the rules below change: activating drops every older cache.
const VERSION = 'v1';
const PAGES = `habibit-pages-${VERSION}`;
const ASSETS = `habibit-assets-${VERSION}`;
const SHELL = '/';

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(PAGES)
      // Keeping the shell right away means a first visit already survives a
      // reload with no signal. It can fail (installed while offline); the app
      // does not depend on it.
      .then((cache) => cache.add(SHELL))
      .catch(() => {})
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      const names = await caches.keys();
      await Promise.all(names.filter((name) => name !== PAGES && name !== ASSETS).map((name) => caches.delete(name)));
      // Take over the pages that are already open, rather than waiting for the next visit.
      await self.clients.claim();
    })(),
  );
});

function isBuildFile(url) {
  return url.origin === self.location.origin && url.pathname.startsWith('/_next/static/');
}

self.addEventListener('fetch', (event) => {
  const request = event.request;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return; // Not ours: leave the browser to it.

  if (request.mode === 'navigate') {
    event.respondWith(pageNetworkFirst(request));
  } else if (isBuildFile(url)) {
    event.respondWith(buildFileCacheFirst(request));
  }
});

async function pageNetworkFirst(request) {
  const cache = await caches.open(PAGES);
  try {
    const response = await fetch(request);
    if (response.ok) await cache.put(request, response.clone());
    return response;
  } catch {
    /*
     * ignoreVary: the app's pages come with a Vary header for the framework's
     * own navigation headers. A kept page is the same page whatever those said,
     * and this is the only copy there is, so matching on them could only fail.
     */
    const kept = (await cache.match(request, { ignoreVary: true })) ?? (await cache.match(SHELL, { ignoreVary: true }));
    return kept ?? Response.error();
  }
}

async function buildFileCacheFirst(request) {
  const cache = await caches.open(ASSETS);
  const kept = await cache.match(request);
  if (kept) return kept;

  const response = await fetch(request);
  if (response.ok) await cache.put(request, response.clone());
  return response;
}

/*
 * A page that has just loaded tells us which build files it used, so offline is
 * armed after one visit instead of two. (Files fetched before this worker took
 * over never passed through it, so it has not seen them.) Only this site's build
 * files are accepted, whatever a message asks for.
 */
self.addEventListener('message', (event) => {
  const data = event.data;
  if (!data || data.type !== 'warm' || !Array.isArray(data.urls)) return;
  event.waitUntil(warm(data.urls));
});

async function warm(urls) {
  const cache = await caches.open(ASSETS);
  await Promise.all(
    urls.map(async (raw) => {
      let url;
      try {
        url = new URL(raw, self.location.origin);
      } catch {
        return;
      }
      if (!isBuildFile(url)) return;
      if (await cache.match(url.href)) return;
      await cache.add(url.href).catch(() => {});
    }),
  );
}

/*
 * ---------------------------------------------------------------------------
 * Reminders (v3 Block D)
 *
 * A push arrives here even when nobody has the app open — that is the whole
 * point of it. The browser requires that every push show something, so each one
 * ends in a notification.
 *
 * The message is written by the sender (Block E) and carries no habit names,
 * only a count: a push passes through a service we do not run, and a lock
 * screen is read over shoulders.
 * ---------------------------------------------------------------------------
 */

const REMINDER_TAG = 'habibit-reminder';

self.addEventListener('push', (event) => {
  let payload = {};
  try {
    payload = event.data ? event.data.json() : {};
  } catch {
    // Not ours, or malformed. Something must still be shown, so fall through
    // to the plain wording below.
  }

  const title = typeof payload.title === 'string' && payload.title ? payload.title : 'Habibit';
  const body =
    typeof payload.body === 'string' && payload.body ? payload.body : 'A gentle nudge about today’s habits.';

  event.waitUntil(
    self.registration.showNotification(title, {
      body,
      icon: '/icons/icon-192.png',
      badge: '/icons/icon-192.png',
      // One tag, so a second reminder replaces the first rather than stacking
      // up a column of them on a phone left alone for a week.
      tag: REMINDER_TAG,
      data: { url: '/' },
    }),
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  event.waitUntil(
    (async () => {
      const url = new URL(event.notification.data?.url ?? '/', self.location.origin).href;
      const clients = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });

      // Bring the app forward if it is already open, rather than opening a
      // second copy of a single-page app.
      for (const client of clients) {
        if (new URL(client.url).origin === self.location.origin) {
          await client.focus();
          if ('navigate' in client && new URL(client.url).pathname !== new URL(url).pathname) {
            await client.navigate(url).catch(() => {});
          }
          return;
        }
      }
      await self.clients.openWindow(url);
    })(),
  );
});
