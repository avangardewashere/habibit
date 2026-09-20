import { defineConfig, devices } from '@playwright/test';

/*
 * Habibit v3 Block G: the smoke test, against the real site.
 *
 * Separate from playwright.config.ts on purpose, and **not part of CI**. The
 * normal browser tests build the app and point it at a throwaway database; this
 * one visits whatever is actually deployed, which is a different question:
 * *did the thing that shipped survive shipping?*
 *
 * It answers only what can be answered without touching anyone's data:
 *
 *   - the app is served, and renders;
 *   - a habit can be added and ticked, in the browser, on the real build;
 *   - the service worker registers, and the app still opens with the network cut;
 *   - the installable bits (manifest, icons) are really there;
 *   - the privacy page loads.
 *
 * **It never signs in and never creates an account.** The live database belongs
 * to real people — by the time this is worth running, one of them is you.
 *
 * Run it after a deploy:
 *   npm run smoke
 *   SMOKE_URL=https://staging.example npm run smoke
 */
const URL_UNDER_TEST = process.env.SMOKE_URL ?? 'https://habibit.vercel.app';

export default defineConfig({
  testDir: './e2e-smoke',
  fullyParallel: true,
  // A live site over a real network: one retry separates a flap from a fault.
  retries: 1,
  reporter: [['list']],

  use: {
    baseURL: URL_UNDER_TEST,
    timezoneId: 'Asia/Manila',
    locale: 'en-US',
    trace: 'retain-on-failure',
  },

  projects: [
    { name: 'android', use: { ...devices['Pixel 7'] } },
    { name: 'desktop', use: { ...devices['Desktop Chrome'] } },
  ],
});
