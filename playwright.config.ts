import { defineConfig, devices } from '@playwright/test';
import { findLocalSupabase, type LocalSupabase } from './test-support/local-supabase';

const PORT = 3100;

/*
 * A throwaway VAPID public key, so the reminder settings exist in the test
 * build. Its private half was generated with it and thrown away: nothing here
 * can send a push, and nothing needs to. The real pair lives in your Supabase
 * secrets and never in this repo.
 */
const TEST_VAPID_PUBLIC_KEY =
  'BGbtY9g5DRcNe-on0oWjT2JO830ymqnyT9lyNyotGmqrK7II1CcIUy0osjYQZ5BEhoe_gk5o94VQugSiv847gSU';
const isCI = Boolean(process.env.CI);

/*
 * The app under test is built against the local Supabase in Docker, never the
 * real project. Next bakes NEXT_PUBLIC_* values into the bundle at build time,
 * so they are passed to the build below; values set here win over .env.local.
 *
 * Without local Supabase the account tests skip locally, but CI refuses to run
 * rather than quietly skipping the most security-sensitive tests.
 */
// Looked up once by the main process; test workers load this file again and
// inherit the answer through the environment instead of asking Docker each time.
const supabase: LocalSupabase | null =
  process.env.HABIBIT_E2E_SUPABASE !== undefined
    ? JSON.parse(process.env.HABIBIT_E2E_SUPABASE)
    : findLocalSupabase();
process.env.HABIBIT_E2E_SUPABASE = JSON.stringify(supabase);
if (!supabase && isCI) throw new Error('CI must run the browser tests against local Supabase.');

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
    env: {
      NEXT_PUBLIC_VAPID_PUBLIC_KEY: TEST_VAPID_PUBLIC_KEY,
      ...(supabase
        ? {
            NEXT_PUBLIC_SUPABASE_URL: supabase.url,
            NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: supabase.publishableKey,
          }
        : {}),
    },
  },
});
