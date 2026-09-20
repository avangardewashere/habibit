import Link from 'next/link';
import type { Metadata } from 'next';
import { AppShell } from '@/components/layout/AppShell';

export const metadata: Metadata = {
  title: 'Privacy — Habibit',
  description: 'What Habibit stores, where it lives, and how to remove it.',
};

/*
 * v3 Block G: the privacy page.
 *
 * Written once strangers could make accounts. Every claim here is checked
 * against the code by e2e/privacy.spec.ts and components/legal/Privacy.test.tsx
 * — not because a test can make a promise true, but because a promise nobody
 * re-reads is the kind that quietly stops being true.
 *
 * It is a server component with no state: nothing on this page may need the
 * very data it is describing.
 */
export default function Privacy() {
  return (
    <AppShell>
      <main className="space-y-6 pb-6">
        <header className="space-y-2">
          <h1 className="text-2xl font-extrabold text-ink">Privacy</h1>
          <p className="text-sm text-ink-soft">
            Habibit is a habit tracker, not a business built on knowing things about you. This page
            says exactly what it keeps.
          </p>
        </header>

        <Section title="Use it without an account">
          <p>
            Signed out, <strong className="text-ink">everything stays in this browser</strong>. Your
            habits, your tasks, what you have ticked and your light-or-dark choice are saved on the
            device and nowhere else. Nothing is sent anywhere, and there is nothing for anyone else
            to look at.
          </p>
          <p>
            Clearing this site&rsquo;s data in your browser removes all of it, permanently.
          </p>
        </Section>

        <Section title="If you sign in">
          <p>An account exists so the same habits can appear on your phone and your computer. It holds:</p>
          <List
            items={[
              'Your email address — used to send a sign-in code, and to know which data is yours.',
              'Your habits and tasks, their titles, and the days you ticked them off.',
              'If you turn on reminders: the time you chose, your time zone, and an address your browser gives us for sending a notification to that device.',
            ]}
          />
          <p>
            There is no password to lose: signing in emails you a one-time code.
          </p>
          <p>
            <strong className="text-ink">The database refuses to show your rows to anyone else.</strong>{' '}
            That is not a policy, it is a rule inside the database itself — every table checks the
            signed-in person against the owner of the row before answering.
          </p>
        </Section>

        <Section title="What Habibit does not do">
          <List
            items={[
              'No analytics, no tracking pixels, no advertising, and no third-party scripts.',
              'Nothing is sold or shared for marketing, ever.',
              'No profile is built from what you track, and nobody reads your habits to improve anything.',
              'No cookie banner, because there are no tracking cookies to ask about.',
            ]}
          />
        </Section>

        <Section title="Who else is involved">
          <p>Three services, each doing one job:</p>
          <List
            items={[
              'Supabase stores the account data and sends the sign-in emails.',
              'Vercel serves the app, and like any web host keeps ordinary server logs of requests.',
              'Your browser’s own push service (Google, Mozilla or Apple, depending on the browser) carries reminders — encrypted, so it cannot read them.',
            ]}
          />
          <p>Reminders only involve a push service once you switch them on.</p>
        </Section>

        <Section title="Leaving">
          <p>
            <strong className="text-ink">Delete account</strong>, in the account popup, removes your
            account and everything synced to it — habits, tasks, completions, reminder settings and
            every registered device. It cannot be undone.
          </p>
          <p>
            The copy on the device you are using stays, and the app keeps working signed out. To
            remove that too, clear this site&rsquo;s data in your browser.
          </p>
          <p>
            <strong className="text-ink">Sign out</strong> does the opposite: it empties this device
            and leaves the account alone.
          </p>
        </Section>

        <Section title="Changes">
          <p>
            If what Habibit stores ever changes, this page changes with it. It is part of the app,
            in the same repository, and reviewed whenever the data model is.
          </p>
        </Section>

        <Link
          href="/"
          className="inline-flex min-h-11 items-center rounded-full border border-ink-soft px-4 text-sm font-extrabold text-ink transition active:scale-95 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
        >
          Back to Habibit
        </Link>
      </main>
    </AppShell>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-2">
      <h2 className="text-base font-extrabold text-ink">{title}</h2>
      <div className="space-y-2 text-sm text-ink-soft">{children}</div>
    </section>
  );
}

function List({ items }: { items: string[] }) {
  return (
    <ul className="list-disc space-y-1 pl-5">
      {items.map((item) => (
        <li key={item}>{item}</li>
      ))}
    </ul>
  );
}
