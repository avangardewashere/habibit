'use client';

import { X } from 'lucide-react';
import { useEffect, useState } from 'react';
import { CheckCircle } from './CheckCircle';

/** How long the confirm stays armed before quietly giving up. */
const CONFIRM_TIMEOUT_MS = 4000;

/**
 * One checkable line, shared by habits and tasks.
 *
 * The whole title area is the toggle so it is comfortable to hit with a thumb,
 * with delete as a separate 44px control beside it. Delete is always visible:
 * a hover-reveal would be unreachable on the phone this app is built for.
 *
 * Deleting takes two taps. Now that state persists, a stray tap destroys real
 * history, and there is no undo. A native `confirm()` would do the job but is
 * jarring on mobile and cannot be styled, so the row arms itself instead and
 * disarms on a timeout or when you touch anything else in the row.
 */
export function ItemRow({
  title,
  checked,
  onToggle,
  onRemove,
  removeLabel,
  confirmLabel,
}: {
  title: string;
  checked: boolean;
  onToggle: () => void;
  onRemove: () => void;
  removeLabel: string;
  confirmLabel: string;
}) {
  const [confirming, setConfirming] = useState(false);

  useEffect(() => {
    if (!confirming) return;
    const timer = setTimeout(() => setConfirming(false), CONFIRM_TIMEOUT_MS);
    return () => clearTimeout(timer);
  }, [confirming]);

  return (
    <li className="flex items-center gap-1 pr-2">
      <button
        type="button"
        role="checkbox"
        aria-checked={checked}
        onClick={() => {
          // Touching the row is also how you back out of a delete.
          if (confirming) {
            setConfirming(false);
            return;
          }
          onToggle();
        }}
        className="flex min-h-14 flex-1 touch-manipulation items-center gap-3 rounded-card px-4 py-2 text-left transition-transform duration-100 active:scale-[0.98] focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-habibit-500"
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

      {confirming ? (
        <button
          type="button"
          onClick={onRemove}
          aria-label={confirmLabel}
          autoFocus
          /*
           * Deliberately no onBlur cancel. Blur fires before the row's click,
           * so cancelling there would disarm first and let the click fall
           * through to the toggle — tapping "somewhere else to cancel" would
           * tick the habit off instead. The timeout is the safety net.
           */
          className="min-h-11 shrink-0 touch-manipulation rounded-full bg-habibit-600 px-3 text-xs font-extrabold text-white transition active:scale-90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-habibit-500"
        >
          Delete?
        </button>
      ) : (
        <button
          type="button"
          onClick={() => setConfirming(true)}
          aria-label={removeLabel}
          className="grid h-11 w-11 shrink-0 touch-manipulation place-items-center rounded-full text-ink-soft/50 transition hover:bg-habibit-50 hover:text-habibit-600 active:scale-90 focus-visible:outline-2 focus-visible:outline-habibit-500"
        >
          <X className="h-4 w-4" strokeWidth={2.5} />
        </button>
      )}
    </li>
  );
}
