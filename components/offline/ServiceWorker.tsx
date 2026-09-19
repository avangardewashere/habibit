'use client';

import { useEffect } from 'react';

/**
 * Registers `public/sw.js`, the script that lets Habibit open with no connection.
 *
 * Renders nothing. If anything here fails — an old browser, a private window,
 * a blocked registration — the app carries on exactly as it did before: the
 * service worker only ever *adds* the offline case.
 */
export function RegisterServiceWorker() {
  useEffect(() => {
    /*
     * Not in development. There the app's files change on every keystroke and
     * are not hash-named, so a cache would serve yesterday's code and fight the
     * dev server. Offline is a production feature; the browser tests run against
     * a production build, so they still cover it.
     */
    if (process.env.NODE_ENV === 'development') return;
    if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) return;

    let gone = false;
    void navigator.serviceWorker
      .register('/sw.js')
      .then(async (registration) => {
        await navigator.serviceWorker.ready;
        if (gone) return;
        // Files this page already fetched never passed through the worker, so it
        // hasn't seen them. Telling it arms offline after one visit, not two.
        const worker = registration.active ?? navigator.serviceWorker.controller;
        worker?.postMessage({ type: 'warm', urls: buildFilesUsed() });
      })
      .catch(() => {});

    return () => {
      gone = true;
    };
  }, []);

  return null;
}

/** The app's own scripts, styles and fonts that this page loaded. */
function buildFilesUsed(): string[] {
  if (typeof performance === 'undefined' || !performance.getEntriesByType) return [];
  const prefix = `${window.location.origin}/_next/static/`;
  return performance
    .getEntriesByType('resource')
    .map((entry) => entry.name)
    .filter((name) => name.startsWith(prefix));
}
