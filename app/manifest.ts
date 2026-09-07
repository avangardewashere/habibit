import type { MetadataRoute } from 'next';

/**
 * Next serves this at /manifest.webmanifest and links it into <head>
 * automatically — no `metadata.manifest` entry needed.
 *
 * A valid manifest over HTTPS is all that installing requires nowadays: Chrome
 * dropped the service-worker-with-fetch-handler rule (mobile 108, desktop 112),
 * and iOS "Add to Home Screen" never wanted one. v0 therefore ships no service
 * worker; that arrives in v2 with offline support, where it earns its place.
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    // Pins the app's identity, so changing start_url later does not register
    // as a different app on someone's home screen.
    id: '/',
    name: 'Habibit',
    short_name: 'Habibit',
    description: 'Little habits. Lots of love.',
    start_url: '/',
    scope: '/',
    display: 'standalone',
    background_color: '#FFFBF7',
    theme_color: '#FFFBF7',
    lang: 'en',
    dir: 'ltr',
    categories: ['productivity', 'lifestyle'],
    // No `orientation` lock: the centred column reads fine in landscape, and
    // forcing portrait would be a restriction with no upside.
    icons: [
      { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
      {
        // Full-bleed and inset, so Android's own mask cannot clip the heart.
        src: '/icons/icon-512-maskable.png',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'maskable',
      },
    ],
  };
}
