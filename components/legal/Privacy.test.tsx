// @vitest-environment jsdom
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import Privacy from '@/app/privacy/page';

/*
 * v3 Block G: keeping the privacy page honest.
 *
 * A promise nobody re-reads is the kind that quietly stops being true. So the
 * strong claims on that page are tied to the code that makes them true: if
 * someone adds an analytics script, or a new column, the claim that says
 * otherwise should go red before anyone reads it and believes it.
 *
 * These tests cannot make a promise true. What they can do is notice when the
 * app and the page have drifted apart.
 */

/** Reads a file of the repo, from the project root (vitest runs there). */
const source = (path: string) => readFileSync(resolve(process.cwd(), path), 'utf8');

describe('V3G: the privacy page', () => {
  it('V3G-01 · says the three things someone actually wants to know', () => {
    render(<Privacy />);

    const said = document.body.textContent ?? '';
    // What is kept, where it lives, and how to get rid of it.
    expect(said).toMatch(/everything stays in this browser/i);
    expect(said).toMatch(/email address/i);
    expect(said).toMatch(/Delete account/);
    expect(said).toMatch(/cannot be undone/i);
  });

  it('V3G-02 · ⭐ names every service that is involved', () => {
    render(<Privacy />);

    const said = document.body.textContent ?? '';
    for (const service of ['Supabase', 'Vercel', 'push service']) {
      expect(said, service).toContain(service);
    }
  });

  it('V3G-03 · ⭐ the "no analytics" claim is checked against the app, not just written down', () => {
    // The claim is only worth making while it is true. If a tracker is ever
    // added, this test is where it shows up.
    render(<Privacy />);
    expect(document.body.textContent).toMatch(/No analytics, no tracking pixels/i);

    const dependencies = Object.keys(JSON.parse(source('package.json')).dependencies ?? {});
    const trackers = /analytics|gtag|posthog|sentry|segment|mixpanel|plausible|fathom|hotjar|clarity/i;
    expect(dependencies.filter((name) => trackers.test(name))).toEqual([]);
  });

  it('V3G-04 · ⭐ every table the account holds is described', () => {
    // A new table is a new thing being stored about someone. This test makes
    // adding one without a word here an obvious omission rather than a silent
    // one.
    render(<Privacy />);
    const said = (document.body.textContent ?? '').toLowerCase();

    const tables = source('supabase/migrations/20260917000000_accounts.sql')
      .concat(source('supabase/migrations/20260921000000_reminders.sql'))
      .matchAll(/create table public\.(\w+)/g);

    const described: Record<string, RegExp> = {
      habits: /habits/,
      tasks: /tasks/,
      completions: /ticked them off|completions/,
      reminder_settings: /the time you chose|time zone/,
      push_subscriptions: /address your browser gives us/,
    };

    for (const [, table] of tables) {
      expect(described[table], `no wording covers the "${table}" table`).toBeDefined();
      expect(said, table).toMatch(described[table]);
    }
  });

  it('V3G-05 · ⭐ it is reachable without an account', () => {
    // Signed out is exactly when someone is deciding whether to hand over an
    // email, so the page cannot live behind the account.
    const home = source('app/page.tsx');
    expect(home).toContain('<Footer />');
    expect(source('components/layout/Footer.tsx')).toContain('href="/privacy"');
  });

  it('V3G-06 · it says what happens with no account at all, first', () => {
    render(<Privacy />);
    const headings = screen.getAllByRole('heading', { level: 2 }).map((h) => h.textContent);
    expect(headings[0]).toBe('Use it without an account');
  });

  it('V3G-07 · offers a way back into the app', () => {
    render(<Privacy />);
    expect(screen.getByRole('link', { name: 'Back to Habibit' })).toHaveAttribute('href', '/');
  });
});
