import { defineConfig, devices } from '@playwright/test';

const PORT = 3100;
const isCI = Boolean(process.env.CI);

/**
 * Browser tests: the automated replacement for the manual QA checklists.
 *
 * They run against a **production build**, never `next dev`. Several of the bugs
 * these tests guard behaved differently between the two (StrictMode double
 * effects only happen in dev), and production is what people actually use.
 */
export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: isCI,
  retries: isCI ? 1 : 0,
  reporter: isCI ? [['github'], ['html', { open: 'never' }]] : [['list'], ['html', { open: 'never' }]],

  use: {
    baseURL: `http://localhost:${PORT}`,
    /*
     * Pinned for the same reason vitest.config.mts pins TZ: "today", streaks
     * and midnight must mean the same thing on every machine and in CI.
     */
    timezoneId: 'Asia/Manila',
    locale: 'en-US',
    trace: 'retain-on-failure',
  },

  /*
   * Chromium only. The supported devices are Android Chrome and desktop Chrome;
   * iOS is kept working but never blocks a release.
   */
  projects: [
    { name: 'android', use: { ...devices['Pixel 7'] } },
    { name: 'desktop', use: { ...devices['Desktop Chrome'] } },
  ],

  webServer: {
    command: `npm run build && npm run start -- --port ${PORT}`,
    url: `http://localhost:${PORT}`,
    // A local run reuses a server you already started; CI always builds fresh.
    reuseExistingServer: !isCI,
    timeout: 240_000,
  },
});
