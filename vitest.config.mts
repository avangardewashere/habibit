import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['lib/**/*.test.ts', 'store/**/*.test.ts', 'store/**/*.test.tsx'],
    setupFiles: ['./vitest.setup.ts'],
    /*
     * Pin the suite to UTC+8 so the local-vs-UTC date assertions are meaningful
     * and identical on every machine and in CI. Set here rather than in the npm
     * script because `TZ=... vitest` is not portable to Windows shells.
     */
    env: { TZ: 'Asia/Manila' },
  },
  resolve: {
    alias: { '@': fileURLToPath(new URL('.', import.meta.url)) },
  },
});
