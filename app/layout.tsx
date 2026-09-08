import type { Metadata, Viewport } from 'next';
import { Nunito } from 'next/font/google';
import './globals.css';
import { THEME_COLOURS, THEME_INIT_SCRIPT } from '@/lib/theme';
import { HabibitProvider } from '@/store/HabibitProvider';

const nunito = Nunito({
  subsets: ['latin'],
  variable: '--font-nunito',
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'Habibit — Little habits. Lots of love.',
  description: 'A gentle habit tracker. Little habits. Lots of love.',
  applicationName: 'Habibit',
  appleWebApp: {
    capable: true,
    title: 'Habibit',
    statusBarStyle: 'default',
  },
};

export const viewport: Viewport = {
  /*
   * Two entries so the status bar follows the device before any JavaScript
   * runs. Once the app knows the real preference, lib/theme.ts replaces these
   * with a single unconditional meta — otherwise forcing dark on a light phone
   * would leave a cream status bar above a plum app.
   */
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: THEME_COLOURS.light },
    { media: '(prefers-color-scheme: dark)', color: THEME_COLOURS.dark },
  ],
  width: 'device-width',
  initialScale: 1,
  /*
   * Makes env(safe-area-inset-*) resolve to real numbers instead of 0 — without
   * it the safe-area padding in AppShell is inert.
   *
   * Deliberately NOT setting `maximumScale: 1` / `userScalable: false`. They are
   * the usual "fix" for iOS zoom-on-focus, and they work by disabling pinch-zoom
   * for everyone, which is an accessibility failure. 16px inputs already solve
   * that properly.
   */
  viewportFit: 'cover',
};

export default function RootLayout({ children }: LayoutProps<'/'>) {
  return (
    <html lang="en" className={nunito.variable}>
      <body>
        {/*
          Runs before the first paint. Without it, anyone using dark mode gets a
          full white flash on every load while waiting for React to hydrate.
        */}
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />
        <HabibitProvider>{children}</HabibitProvider>
      </body>
    </html>
  );
}
