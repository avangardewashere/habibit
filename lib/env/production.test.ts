import { describe, expect, it } from 'vitest';
import { missing, productionEnvProblem, productionEnvWarnings } from './production';

/*
 * The production build check.
 *
 * Several of these tests are the mistakes that actually happened while
 * launching v3, in the order they happened. Each one produced a build that
 * succeeded, deployed, and served a site with no account button, and nothing
 * said so. Each one now fails the build instead.
 */

const URL = 'https://example.supabase.co';
const KEY = 'sb_publishable_example';

const production = (extra: Record<string, string | undefined> = {}) => ({ VERCEL_ENV: 'production', ...extra });
const complete = () => production({ NEXT_PUBLIC_SUPABASE_URL: URL, NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: KEY });

describe('the production build check', () => {
  it('ENV-01 · ⭐ a production build with both settings may finish', () => {
    expect(productionEnvProblem(complete())).toBeNull();
  });

  it('ENV-02 · ⭐ a production build with neither setting is stopped, and names both', () => {
    const problem = productionEnvProblem(production());

    expect(problem).not.toBeNull();
    expect(problem).toContain('NEXT_PUBLIC_SUPABASE_URL is not set');
    expect(problem).toContain('NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY is not set');
  });

  it('ENV-03 · ⭐ one missing is enough to stop it', () => {
    const problem = productionEnvProblem(production({ NEXT_PUBLIC_SUPABASE_URL: URL }));

    expect(problem).toContain('NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY is not set');
    expect(problem).not.toContain('NEXT_PUBLIC_SUPABASE_URL is');
  });

  it('ENV-04 · ⭐ the first launch mistake: the right key under the ANON_KEY name', () => {
    const problem = productionEnvProblem(
      production({ NEXT_PUBLIC_SUPABASE_URL: URL, NEXT_PUBLIC_SUPABASE_ANON_KEY: KEY }),
    );

    expect(problem).toContain('NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY is not set');
    // And it says what probably happened, rather than leaving it to be found.
    expect(problem).toContain('NEXT_PUBLIC_SUPABASE_ANON_KEY is set — it should be named NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY');
  });

  it('ENV-05 · ⭐ a value that is set but empty counts as missing', () => {
    // The app treats an empty value exactly like an absent one, and an empty
    // value is easy to end up with while editing a variable's scope.
    const problem = productionEnvProblem(
      production({ NEXT_PUBLIC_SUPABASE_URL: URL, NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: '' }),
    );

    expect(problem).toContain('NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY is set, but empty');
  });

  it('ENV-06 · ⭐ a value of only spaces counts as missing too', () => {
    const problem = productionEnvProblem(
      production({ NEXT_PUBLIC_SUPABASE_URL: '   ', NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: KEY }),
    );

    expect(problem).toContain('NEXT_PUBLIC_SUPABASE_URL is set, but empty');
  });

  it('ENV-07 · ⭐ the second launch mistake: settings scoped to Preview are not checked by a Preview build', () => {
    // Preview deploys run without the real settings on purpose. The check is
    // for the build that becomes the real site, and only that one.
    expect(productionEnvProblem({ VERCEL_ENV: 'preview' })).toBeNull();
    expect(productionEnvProblem({ VERCEL_ENV: 'development' })).toBeNull();
  });

  it('ENV-08 · ⭐ a local build and the CI build are never stopped by it', () => {
    // Neither sets VERCEL_ENV. Both must keep building with no real settings.
    expect(productionEnvProblem({})).toBeNull();
    expect(productionEnvProblem({ CI: 'true' })).toBeNull();
  });

  it('ENV-09 · the message says how to fix it, and that the live site is safe', () => {
    const problem = productionEnvProblem(production()) ?? '';

    expect(problem).toMatch(/Production ticked/);
    expect(problem).toMatch(/does not promote a failed build/);
  });

  it('ENV-10 · ⭐ it never prints a value, only names', () => {
    // A build log is shared more widely than a settings page.
    const problem =
      productionEnvProblem(
        production({ NEXT_PUBLIC_SUPABASE_URL: URL, NEXT_PUBLIC_SUPABASE_ANON_KEY: 'sb_publishable_SECRETLOOKING' }),
      ) ?? '';

    expect(problem).not.toContain('sb_publishable_SECRETLOOKING');
    expect(problem).not.toContain(URL);
  });
});

describe('what is only worth a warning', () => {
  it('ENV-20 · a missing reminder key warns, but does not stop the build', () => {
    expect(productionEnvProblem(complete())).toBeNull();
    expect(productionEnvWarnings(complete())).toEqual([
      'Habibit: NEXT_PUBLIC_VAPID_PUBLIC_KEY is not set, so reminders are hidden on this build.',
    ]);
  });

  it('ENV-21 · with the reminder key set there is nothing to warn about', () => {
    expect(productionEnvWarnings({ ...complete(), NEXT_PUBLIC_VAPID_PUBLIC_KEY: 'BKey' })).toEqual([]);
  });

  it('ENV-22 · warnings, like the check, are for production only', () => {
    expect(productionEnvWarnings({})).toEqual([]);
    expect(productionEnvWarnings({ VERCEL_ENV: 'preview' })).toEqual([]);
  });
});

describe('missing', () => {
  it('ENV-30 · lists absent and blank names, in order, and nothing else', () => {
    expect(missing({ A: 'x', B: '', D: ' ' }, ['A', 'B', 'C', 'D'])).toEqual(['B', 'C', 'D']);
  });
});
