'use client';

import { Check, MoreHorizontal } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import type { KeyboardEvent, ReactNode } from 'react';
import { CheckCircle } from './CheckCircle';

/** How long the Rename / Delete menu stays open before quietly closing. */
const MENU_TIMEOUT_MS = 4000;

type Mode = 'idle' | 'menu' | 'editing';

/**
 * One checkable line, shared by habits and tasks.
 *
 * The whole title area is the toggle so it is comfortable to hit with a thumb.
 * Everything else a row can do lives behind a single `⋯` control, which opens
 * Rename and Delete in place. One button instead of a pencil *and* an `×` keeps
 * about 48px more room for the title on a phone (measured: 178px vs 130px).
 *
 * Deleting is still two taps — `⋯` then Delete — because a stray tap would
 * destroy real history and there is no undo.
 */
export function ItemRow({
  title,
  checked,
  onToggle,
  onRemove,
  onRename,
  actionsLabel,
  renameLabel,
  deleteLabel,
  trailing,
  below,
}: {
  title: string;
  checked: boolean;
  onToggle: () => void;
  onRemove: () => void;
  /** Receives the raw input; the reducer trims it and rejects an empty title. */
  onRename: (title: string) => void;
  /** Accessible name for the `⋯` button, e.g. "More actions for Drink water". */
  actionsLabel: string;
  renameLabel: string;
  /** Should say what deleting costs, e.g. "…and its whole completion history". */
  deleteLabel: string;
  /** Sits between the title and the actions. Habits put their streak here. */
  trailing?: ReactNode;
  /** Full-width, under the title. Habits put their 7-day strip here. */
  below?: ReactNode;
}) {
  const [mode, setMode] = useState<Mode>('idle');
  const [draft, setDraft] = useState(title);
  const inputRef = useRef<HTMLInputElement>(null);

  /*
   * Escape unmounts the input, and a focused element being removed can still
   * fire blur on the way out — which would commit the very edit being
   * cancelled. This marks that one blur to be ignored.
   */
  const skipNextBlur = useRef(false);

  useEffect(() => {
    if (mode !== 'menu') return;
    const timer = setTimeout(() => setMode('idle'), MENU_TIMEOUT_MS);
    return () => clearTimeout(timer);
  }, [mode]);

  useEffect(() => {
    if (mode === 'editing') inputRef.current?.select();
  }, [mode]);

  function startEditing() {
    // Whether or not the last session's unmount fired a blur, a new session
    // starts clean — otherwise a leftover flag would silently swallow this
    // session's blur-to-save.
    skipNextBlur.current = false;
    setDraft(title);
    setMode('editing');
  }

  function commit() {
    // Unchanged or blank: just close. The reducer would reject a blank title
    // anyway, but not dispatching keeps a no-op edit truly a no-op.
    if (draft.trim() && draft.trim() !== title) onRename(draft);
    setMode('idle');
  }

  function cancel() {
    skipNextBlur.current = true;
    setDraft(title);
    setMode('idle');
  }

  function onKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    // Mid-composition (predictive text, CJK input), Enter confirms the word
    // being composed rather than the field. Saving there would store a
    // half-typed name.
    if (event.nativeEvent.isComposing) return;

    if (event.key === 'Enter') {
      event.preventDefault();
      skipNextBlur.current = true;
      commit();
    } else if (event.key === 'Escape') {
      event.preventDefault();
      cancel();
    }
  }

  if (mode === 'editing') {
    return (
      <li>
        <div className="flex min-h-14 items-center gap-1 pr-2">
          <div className="flex flex-1 items-center gap-3 pl-4">
            <CheckCircle checked={checked} />
            <input
              ref={inputRef}
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
              onKeyDown={onKeyDown}
              onBlur={() => {
                if (skipNextBlur.current) {
                  skipNextBlur.current = false;
                  return;
                }
                commit();
              }}
              aria-label={renameLabel}
              enterKeyHint="done"
              autoComplete="off"
              autoFocus
              /* text-base is 16px: below that, iOS Safari zooms on focus. */
              className="min-w-0 flex-1 rounded-lg border border-accent bg-surface px-2 py-1.5 text-base text-ink outline-none"
            />
          </div>
          <button
            type="button"
            aria-label="Save name"
            /*
             * Keep focus in the input while pressing. Otherwise the input blurs
             * first (committing), unmounts, and this click lands on nothing —
             * the same blur-before-click race that broke cancel-delete in v0.5.
             */
            onPointerDown={(event) => event.preventDefault()}
            onClick={() => {
              skipNextBlur.current = true;
              commit();
            }}
            className="grid h-11 w-11 shrink-0 touch-manipulation place-items-center rounded-full bg-accent text-on-accent transition active:scale-90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
          >
            <Check className="h-4 w-4" strokeWidth={3} />
          </button>
        </div>
        {below}
      </li>
    );
  }

  return (
    <li>
      <div className="flex items-center gap-1 pr-2">
        <button
          type="button"
          role="checkbox"
          aria-checked={checked}
          onClick={() => {
            // Touching the row is also how you close the menu. The tap is
            // swallowed so closing it never ticks the item by accident.
            if (mode === 'menu') {
              setMode('idle');
              return;
            }
            onToggle();
          }}
          className="flex min-h-14 flex-1 touch-manipulation items-center gap-3 rounded-card px-4 py-2 text-left transition-transform duration-100 active:scale-[0.98] focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-accent"
        >
          <CheckCircle checked={checked} />
          <span
            className={[
              'min-w-0 break-words text-[15px] leading-snug transition-colors',
              checked ? 'text-ink-soft line-through' : 'text-ink',
            ].join(' ')}
          >
            {title}
          </span>
        </button>

        {mode === 'menu' ? (
          <div className="flex shrink-0 items-center gap-1">
            <button
              type="button"
              onClick={startEditing}
              aria-label={renameLabel}
              /*
               * border-ink-soft, not border-line: `line` is only 1.16:1 against
               * the card in dark mode, so the pill read as loose text rather
               * than a button. ink-soft is 5.08 light / 5.20 dark.
               */
              className="min-h-11 touch-manipulation rounded-full border border-ink-soft bg-card px-3 text-xs font-extrabold text-ink transition active:scale-90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
            >
              Rename
            </button>
            <button
              type="button"
              onClick={onRemove}
              aria-label={deleteLabel}
              className="min-h-11 touch-manipulation rounded-full bg-danger px-3 text-xs font-extrabold text-on-danger transition active:scale-90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
            >
              Delete
            </button>
          </div>
        ) : (
          <>
            {trailing}
            <button
              type="button"
              onClick={() => setMode('menu')}
              aria-label={actionsLabel}
              aria-haspopup="true"
              aria-expanded={false}
              className="grid h-11 w-11 shrink-0 touch-manipulation place-items-center rounded-full text-ink-soft transition hover:bg-badge-bg hover:text-ink active:scale-90 focus-visible:outline-2 focus-visible:outline-accent"
            >
              <MoreHorizontal className="h-5 w-5" strokeWidth={2.5} />
            </button>
          </>
        )}
      </div>

      {below}
    </li>
  );
}
