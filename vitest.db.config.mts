import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

/**
 * Database tests: run against the local Supabase in Docker (`npm run db:start`).
 * Kept apart from `npm test` so the fast unit tests never need Docker.
 */
export default defineConfig({
  test: {
    environment: 'node',
    include: ['supabase/tests/**/*.test.ts'],
    testTimeout: 30_000,
    hookTimeout: 60_000,
  },
  resolve: {
    alias: { '@': fileURLToPath(new URL('.', import.meta.url)) },
  },
});
