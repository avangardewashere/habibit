'use client';

import { Check, Monitor, Moon, Sun } from 'lucide-react';
import type { ComponentType } from 'react';
import type { ThemePreference } from '@/lib/theme';
import { setThemePreference, useThemePreference } from '@/lib/useTheme';

const OPTIONS: {
  value: ThemePreference;
  /** Shown in the row. */
  label: string;
  /** What a screen reader hears; starts with the visible label. */
  name: string;
  Icon: ComponentType<{ className?: string; strokeWidth?: number }>;
}[] = [
  { value: 'light', label: 'Light', name: 'Light theme', Icon: Sun },
  { value: 'dark', label: 'Dark', name: 'Dark theme', Icon: Moon },
  { value: 'system', label: 'Match device', name: 'Match device theme', Icon: Monitor },
];

/**
 * The three themes as rows in Settings (v5 Block B).
 *
 * This was a header button with a popup from v3 Block A. With a Settings tab to
 * hold it, all three choices can simply be on screen: one tap to change, and
 * nothing to open first. A real radio group, so a screen reader hears "one of
 * three" and the arrow keys move between them.
 *
 * Only draws. Keeping the page in step with the stored theme on load is still
 * ThemeEffect's job — this exists only while Settings is open.
 */
export function ThemeSetting() {
  const preference = useThemePreference();

  return (
    <div role="radiogroup" aria-label="Colour theme" className="divide-y divide-line">
      {OPTIONS.map(({ value, label, name, Icon }) => {
        const active = preference === value;
        return (
          <button
            key={value}
            type="button"
            role="radio"
            aria-checked={active}
            aria-label={name}
            onClick={() => setThemePreference(value)}
            className="flex min-h-12 w-full touch-manipulation items-center gap-3 px-4 text-left text-[15px] font-semibold text-ink transition active:bg-surface focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-accent"
          >
            <Icon className="h-5 w-5 shrink-0 text-ink-soft" strokeWidth={2.25} />
            <span className="min-w-0 flex-1">{label}</span>
            {/* A tick, not only a colour, marks the one in use. */}
            {active && <Check aria-hidden className="h-5 w-5 shrink-0 text-accent" strokeWidth={3} />}
          </button>
        );
      })}
    </div>
  );
}
