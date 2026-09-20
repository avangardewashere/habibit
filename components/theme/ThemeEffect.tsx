'use client';

import { applyTheme } from '@/lib/theme';
import { useIsomorphicLayoutEffect } from '@/lib/useIsomorphicLayoutEffect';
import { useThemePreference } from '@/lib/useTheme';

/**
 * Keeps the page in step with the stored theme on every load. Renders nothing.
 *
 * The inline script in the layout has already set the colours before first paint,
 * but it leaves the status-bar metas as the server rendered them (the
 * light/dark pair). With dark forced on a light phone, that pair would give a
 * cream status bar above a plum app until something called `applyTheme`.
 *
 * This used to live inside the theme buttons. It is its own component so the
 * buttons can sit in a menu that only exists while open (docs/backlog.md): an
 * effect inside that menu would not run until you opened it.
 *
 * It also watches the head. When the page changes, Next renders fresh
 * theme-color metas with the default light/dark colours (found in v3 Block A,
 * leaving the sign-in page), so whenever one appears the theme is re-applied.
 * Watching for the metas themselves, rather than for a page change, means it
 * doesn't matter when or how Next updates the head.
 *
 * No dependency on the OS here: while the preference is `system` the browser
 * tracks the device itself via the media-scoped metas, which is one less event
 * to miss.
 */
export function ThemeEffect() {
  const preference = useThemePreference();

  useIsomorphicLayoutEffect(() => {
    applyTheme(preference);

    // applyTheme only edits attributes, which this doesn't watch, so it can't
    // trigger itself.
    const observer = new MutationObserver((records) => {
      const added = records.flatMap((record) => [...record.addedNodes]);
      if (added.some((node) => node instanceof HTMLMetaElement && node.name === 'theme-color')) {
        applyTheme(preference);
      }
    });
    observer.observe(document.head, { childList: true });
    return () => observer.disconnect();
  }, [preference]);

  return null;
}
