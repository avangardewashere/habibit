import Link from 'next/link';

/**
 * One quiet line at the bottom of the app.
 *
 * It exists because of the account button: the moment someone can hand over an
 * email address, there has to be somewhere that says what happens to it. Signed
 * out it is the only route to that page, so it is on the main screen rather
 * than tucked inside a menu.
 */
export function Footer() {
  return (
    <footer className="mt-8 flex justify-center">
      <Link
        href="/privacy"
        className="min-h-11 content-center px-3 text-xs font-bold text-ink-soft underline-offset-2 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
      >
        Privacy
      </Link>
    </footer>
  );
}
