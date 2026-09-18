// @vitest-environment jsdom
import { render } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { RegisterServiceWorker } from './ServiceWorker';

/*
 * v2 Block F: the app registers its service worker, and never depends on it.
 *
 * What the worker itself does with the network is proven by the browser tests in
 * `e2e/offline.spec.ts`; this file covers the handover from the app to it.
 */

const ORIGIN = window.location.origin;

/** A browser that supports service workers, with everything it does recorded. */
function browserWithServiceWorkers({ register }: { register?: () => Promise<unknown> } = {}) {
  const postMessage = vi.fn();
  const registration = { active: { postMessage } };
  const registerFn = vi.fn(register ?? (async () => registration));
  Object.defineProperty(navigator, 'serviceWorker', {
    configurable: true,
    value: { register: registerFn, ready: Promise.resolve(registration), controller: null },
  });
  return { register: registerFn, postMessage };
}

function pageLoaded(...urls: string[]) {
  vi.spyOn(performance, 'getEntriesByType').mockReturnValue(
    urls.map((name) => ({ name })) as unknown as PerformanceEntryList,
  );
}

/** Lets the registration's promises settle. */
const settle = () => new Promise((resolve) => setTimeout(resolve, 0));

afterEach(() => {
  vi.restoreAllMocks();
  Reflect.deleteProperty(navigator, 'serviceWorker');
});

describe('V2F: registering the service worker', () => {
  it('V2F-01 · ⭐ registers /sw.js when the app loads', async () => {
    const { register } = browserWithServiceWorkers();
    pageLoaded();

    render(<RegisterServiceWorker />);
    await settle();

    expect(register).toHaveBeenCalledWith('/sw.js');
  });

  it('V2F-02 · ⭐ tells the worker which of the app’s own files this page used, and nothing else', async () => {
    const { postMessage } = browserWithServiceWorkers();
    pageLoaded(
      `${ORIGIN}/_next/static/chunks/main.js`,
      `${ORIGIN}/_next/static/media/nunito.woff2`,
      `${ORIGIN}/manifest.webmanifest`,
      'https://qvisxzmpoddzhrkauovw.supabase.co/rest/v1/habits',
    );

    render(<RegisterServiceWorker />);
    await settle();

    expect(postMessage).toHaveBeenCalledWith({
      type: 'warm',
      urls: [`${ORIGIN}/_next/static/chunks/main.js`, `${ORIGIN}/_next/static/media/nunito.woff2`],
    });
  });

  it('V2F-03 · a browser without service workers is left alone', () => {
    expect('serviceWorker' in navigator).toBe(false);
    expect(() => render(<RegisterServiceWorker />)).not.toThrow();
  });

  it('V2F-04 · a registration the browser refuses changes nothing', async () => {
    browserWithServiceWorkers({ register: async () => Promise.reject(new Error('blocked in a private window')) });
    pageLoaded();

    const { container } = render(<RegisterServiceWorker />);
    await settle();

    expect(container).toBeEmptyDOMElement();
  });
});
