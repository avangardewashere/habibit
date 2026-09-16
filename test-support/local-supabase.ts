import { execSync } from 'node:child_process';

/**
 * Connection details for the Supabase running locally in Docker (`npm run db:start`).
 *
 * Tests only ever talk to this local copy, never to the real project. The keys it
 * reports are the fixed development keys every local Supabase uses; they unlock
 * nothing outside this machine.
 */
export type LocalSupabase = {
  url: string;
  publishableKey: string;
  /** Full admin access. Tests use it to create users; the app never sees it. */
  secretKey: string;
  /** Mailpit, which catches every email the local Supabase "sends". */
  mailUrl: string;
};

let cached: LocalSupabase | null | undefined;

/** `null` when local Supabase is not running. */
export function findLocalSupabase(): LocalSupabase | null {
  if (cached !== undefined) return cached;
  try {
    const out = execSync('npx supabase status -o json', {
      stdio: ['ignore', 'pipe', 'ignore'],
      timeout: 60_000,
    }).toString();
    const status = JSON.parse(out.slice(out.indexOf('{')));
    cached =
      status.API_URL && status.PUBLISHABLE_KEY && status.SECRET_KEY
        ? {
            url: status.API_URL,
            publishableKey: status.PUBLISHABLE_KEY,
            secretKey: status.SECRET_KEY,
            mailUrl: status.MAILPIT_URL ?? status.INBUCKET_URL,
          }
        : null;
  } catch {
    cached = null;
  }
  return cached;
}

export function requireLocalSupabase(): LocalSupabase {
  const local = findLocalSupabase();
  if (!local) {
    throw new Error(
      'Local Supabase is not running. Start Docker Desktop, then run `npm run db:start`.',
    );
  }
  return local;
}

/** A unique address per test, so tests never share users or emails. */
export function testEmail(label: string): string {
  const suffix = `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
  return `habibit-${label}-${suffix}@example.com`;
}
