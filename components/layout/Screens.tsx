'use client';

import { useEffect, useRef, type ReactNode } from 'react';
import { ProgressScreen } from '@/components/progress/ProgressScreen';
import { SettingsScreen } from '@/components/settings/SettingsScreen';
import { useTab } from '@/lib/useTab';
import { BottomNav } from './BottomNav';

/**
 * Whichever of the three places the address names, and the bar to move between
 * them (v5 Block B).
 *
 * Today arrives as `today` from the page, so it can still be rendered on the
 * server and be on screen before any script has run. The other two exist only
 * in the browser: the server can't see the hash, so it always renders Today.
 *
 * Only the current screen is mounted. A half-finished rename or an open sheet
 * on Today is let go when you leave, which is what leaving means in an app.
 */
export function Screens({ today }: { today: ReactNode }) {
  const tab = useTab();
  const first = useRef(true);

  useEffect(() => {
    // Not on first load: that is a fresh page, already at the top, and taking
    // focus there would steal it from wherever the browser put it.
    if (first.current) {
      first.current = false;
      return;
    }
    // A new screen starts at its top, and a screen reader hears where it is:
    // focus moves to the new screen's heading, as it would on a new page.
    window.scrollTo(0, 0);
    document.getElementById('screen-heading')?.focus({ preventScroll: true });
  }, [tab]);

  return (
    <>
      {tab === 'today' && today}
      {tab === 'progress' && <ProgressScreen />}
      {tab === 'settings' && <SettingsScreen />}
      <BottomNav current={tab} />
    </>
  );
}
