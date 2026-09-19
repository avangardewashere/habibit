'use client';

import { Check, Monitor, Moon, Sun } from 'lucide-react';
import { useId, type ComponentType } from 'react';
import { usePopover } from '@/components/ui/usePopover';
import type { ThemePreference } from '@/lib/theme';
import { setThemePreference, useThemePreference } from '@/lib/useTheme';

const OPTIONS: {
  value: ThemePreference;
  /** Shown in the menu. */
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
 * One header button showing the current theme, opening a menu of the three.
 *
 * Only draws. Keeping the page in step with the stored theme on load is
 * ThemeEffect's job, because this menu's contents exist only while it is open.
 */
export function ThemeMenu() {
  const preference = useThemePreference();
  const { open, toggle, close, anchorRef, wrapperRef } = usePopover<HTMLButtonElement, HTMLDivElement>();
  const menuId = useId();
  const current = OPTIONS.find((option) => option.value === preference) ?? OPTIONS[2];

  return (
    // Not `relative`, like the account menu: the popup lines up with the right edge of the header.
    <div ref={wrapperRef}>
      <button
        ref={anchorRef}
        type="button"
        onClick={toggle}
        aria-label={`Theme: ${current.label}`}
        aria-expanded={open}
        aria-controls={menuId}
        className={[
          'grid h-11 w-11 touch-manipulation place-items-center rounded-full border border-line bg-card text-ink-soft transition active:scale-90',
          'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent',
        ].join(' ')}
      >
        <current.Icon className="h-5 w-5" strokeWidth={2.5} />
      </button>

      {open && (
        <div
          id={menuId}
          role="radiogroup"
          aria-label="Colour theme"
          className="absolute right-0 top-full z-20 mt-2 w-56 rounded-card border border-line bg-card p-1 shadow-lg"
        >
          {OPTIONS.map(({ value, label, name, Icon }) => {
            const active = preference === value;
            return (
              <button
                key={value}
                type="button"
                role="radio"
                aria-checked={active}
                aria-label={name}
                onClick={() => {
                  setThemePreference(value);
                  close(true);
                }}
                className={[
                  'flex h-11 w-full touch-manipulation items-center gap-3 rounded-full px-3 text-left text-sm font-semibold transition',
                  'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent',
                  active ? 'bg-accent text-on-accent' : 'text-ink active:scale-[0.98]',
                ].join(' ')}
              >
                <Icon className="h-4 w-4 shrink-0" strokeWidth={2.5} />
                <span className="min-w-0 flex-1">{label}</span>
                {active && <Check aria-hidden className="h-4 w-4 shrink-0" strokeWidth={3} />}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
