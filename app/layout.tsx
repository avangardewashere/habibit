import type { Metadata, Viewport } from 'next';
import { Nunito } from 'next/font/google';
import './globals.css';
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
    // The status bar is cream like the app, so it wants dark text: `default`.
    statusBarStyle: 'default',
  },
};

export const viewport: Viewport = {
  // Tints the status bar in standalone mode. Cream matches the page, so there
  // is no seam between the system bar and the app.
  themeColor: '#FFFBF7',
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
        <HabibitProvider>{children}</HabibitProvider>
      </body>
    </html>
  );
}
