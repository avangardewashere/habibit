'use client';

import { Sparkles } from 'lucide-react';
import { hasSample } from '@/lib/sample';
import { useToday } from '@/lib/useToday';
import { useHabibit } from '@/store/HabibitProvider';
import { useUndo } from '@/store/UndoProvider';

/**
 * Says, while they are here, that the sample habits are made up (v5 Block C) —
 * and clears them in one tap.
 *
 * At the top of Today rather than tucked in Settings: a visitor deciding
 * whether this app is for them should never mistake someone else's months
 * for their own, and the way out should be as close as the way in was.
 * Clearing can be undone for a few seconds, like a delete.
 */
export function SampleBanner() {
  const { state, dispatch } = useHabibit();
  const { offer } = useUndo();
  const today = useToday();

  if (!hasSample(state)) return null;

  return (
    <aside
      aria-label="Sample habits"
      className="mb-6 flex items-center gap-3 rounded-card bg-badge-bg px-4 py-3 text-badge-fg"
    >
      <Sparkles aria-hidden className="h-5 w-5 shrink-0" strokeWidth={2.5} />
      <p className="min-w-0 flex-1 text-sm leading-snug">
        <strong className="font-extrabold">Sample habits.</strong> Made up, to show what Habibit does.
      </p>
      <button
        type="button"
        onClick={() => {
          dispatch({ type: 'CLEAR_SAMPLE' });
          if (today) offer('Sample habits cleared', () => dispatch({ type: 'LOAD_SAMPLE', today }));
        }}
        className="min-h-11 shrink-0 touch-manipulation rounded-full border border-badge-fg px-3 text-xs font-extrabold transition active:scale-95 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
      >
        Clear them
      </button>
    </aside>
  );
}
