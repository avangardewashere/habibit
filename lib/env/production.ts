/*
 * The settings a production build cannot go without.
 *
 * Why this exists: a Habibit build with no Supabase settings is a *valid* build.
 * Accounts are optional twice over (lib/supabase/client.ts), so a missing or
 * blank value doesn't break anything — it quietly ships an app with accounts
 * switched off. That is right for a fork or a preview, and exactly wrong for the
 * real site.
 *
 * It took five rounds to find, the first time. The variable was named
 * `…_ANON_KEY` instead of `…_PUBLISHABLE_KEY`, then scoped to Preview instead of
 * Production — and every one of those builds succeeded, deployed, and served a
 * site with no account button. Nothing anywhere said so.
 *
 * So a production build now refuses to finish without them, and says which one
 * is missing. Vercel does not promote a failed build, so the site already live
 * stays live while it is fixed.
 *
 * This file has no imports on purpose: it is read by next.config.ts at build
 * time, and tested on its own by `npm test`.
 */

/** Without these, the production site silently has no accounts. */
export const REQUIRED_IN_PRODUCTION = [
  'NEXT_PUBLIC_SUPABASE_URL',
  'NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY',
] as const;

/**
 * Without this, reminders are hidden but everything else works. Worth a warning,
 * not a failed build: reminders are opt-in, and the keys may not exist yet.
 */
export const OPTIONAL_IN_PRODUCTION = ['NEXT_PUBLIC_VAPID_PUBLIC_KEY'] as const;

/**
 * Names that are easy to type instead of the right one, mapped to the right one.
 * Supabase's own docs, and most tutorials, still say ANON_KEY.
 */
const LOOKALIKES: Record<string, string> = {
  NEXT_PUBLIC_SUPABASE_ANON_KEY: 'NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY',
  SUPABASE_URL: 'NEXT_PUBLIC_SUPABASE_URL',
  SUPABASE_PUBLISHABLE_KEY: 'NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY',
};

type Env = Record<string, string | undefined>;

/**
 * Blank counts as missing. The app treats an empty value exactly like an absent
 * one, and an empty value is easy to end up with when editing a variable's scope.
 */
const isBlank = (value: string | undefined) => value === undefined || value.trim() === '';

/** Which of `names` are missing or blank in `env`. */
export function missing(env: Env, names: readonly string[]): string[] {
  return names.filter((name) => isBlank(env[name]));
}

/**
 * Why this build must not finish, or `null` if it may.
 *
 * Only a **production** build on Vercel is held to this. Local builds, the CI
 * build and preview deploys all run without the real settings on purpose, and
 * must keep working.
 */
export function productionEnvProblem(env: Env): string | null {
  if (env.VERCEL_ENV !== 'production') return null;

  const absent = missing(env, REQUIRED_IN_PRODUCTION);
  if (absent.length === 0) return null;

  const lines = [
    'Habibit: this production build is missing settings it cannot go without.',
    '',
    ...absent.map((name) => `  • ${name} is ${env[name] === undefined ? 'not set' : 'set, but empty'}`),
  ];

  // The mistake that actually happened: the right value under the wrong name.
  const hints = Object.entries(LOOKALIKES)
    .filter(([wrong, right]) => absent.includes(right as (typeof REQUIRED_IN_PRODUCTION)[number]) && !isBlank(env[wrong]))
    .map(([wrong, right]) => `  • ${wrong} is set — it should be named ${right}`);
  if (hints.length > 0) lines.push('', 'Possibly the cause:', ...hints);

  lines.push(
    '',
    'Without them the site builds and deploys, but with accounts silently switched off.',
    'Set them in Vercel → Settings → Environment Variables, with Production ticked, then redeploy.',
    'The site already live is unaffected: Vercel does not promote a failed build.',
  );

  return lines.join('\n');
}

/** Settings that are missing but survivable, for a warning in the build log. */
export function productionEnvWarnings(env: Env): string[] {
  if (env.VERCEL_ENV !== 'production') return [];
  return missing(env, OPTIONAL_IN_PRODUCTION).map(
    (name) => `Habibit: ${name} is not set, so reminders are hidden on this build.`,
  );
}
