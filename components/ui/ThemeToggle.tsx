'use client';

import { Monitor, Moon, Sun } from 'lucide-react';
import type { ComponentType } from 'react';
import { applyTheme, type ThemePreference } from '@/lib/theme';
import { useIsomorphicLayoutEffect } from '@/lib/useIsomorphicLayoutEffect';
import { setThemePreference, useThemePreference } from '@/lib/useTheme';

const OPTIONS: { value: ThemePreference; label: string; Icon: ComponentType<{ className?: string; strokeWidth?: number }> }[] = [
  { value: 'light', label: 'Light theme', Icon: Sun },
  { value: 'dark', label: 'Dark theme', Icon: Moon },
  { value: 'system', label: 'Match device theme', Icon: Monitor },
];

export function ThemeToggle() {
  const preference = useThemePreference();

  /*
   * Syncs the DOM with the stored preference on mount, so the status-bar metas
   * match what the inline script already painted. No dependency on the OS here:
   * while the preference is `system` the browser tracks the device itself via
   * the media-scoped metas, which is one less event to miss.
   */
  useIsomorphicLayoutEffect(() => {
    applyTheme(preference);
  }, [preference]);

  return (
    <div
      role="radiogroup"
      aria-label="Colour theme"
      className="flex shrink-0 items-center rounded-full border border-line bg-card"
    >
      {OPTIONS.map(({ value, label, Icon }) => {
        const active = preference === value;
        return (
          <button
            key={value}
            type="button"
            role="radio"
            aria-checked={active}
            aria-label={label}
            onClick={() => setThemePreference(value)}
            className={[
              'grid h-11 w-11 touch-manipulation place-items-center rounded-full transition',
              'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent',
              active ? 'bg-accent text-on-accent' : 'text-ink-soft active:scale-90',
            ].join(' ')}
          >
            <Icon className="h-4 w-4" strokeWidth={2.5} />
          </button>
        );
      })}
    </div>
  );
}
