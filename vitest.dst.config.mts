import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

/**
 * The same code, in a timezone where the clocks change.
 *
 * The main suite is pinned to UTC+8, which has no daylight saving — so on its
 * own it can never catch a date bug that only appears when a day is 23 or 25
 * hours long, and every such test there would pass while proving nothing.
 *
 * Santiago is the harshest realistic case: the clocks go **forward at
 * midnight**, so on 2026-09-06 local midnight does not exist at all. A date
 * built at midnight that day slides into the day before, which is exactly the
 * trap `lib/date.ts` anchors its arithmetic at noon to avoid.
 *
 * Files named `*.dst.test.ts` run here and are excluded from `npm test`.
 * Changing `process.env.TZ` inside a test cannot replace this: on Windows the
 * change is ignored, so the tests would silently run in UTC+8 again.
 */
export default defineConfig({
  test: {
    environment: 'node',
    include: ['**/*.dst.test.ts'],
    setupFiles: ['./vitest.setup.ts'],
    env: { TZ: 'America/Santiago' },
  },
  resolve: {
    alias: { '@': fileURLToPath(new URL('.', import.meta.url)) },
  },
});
