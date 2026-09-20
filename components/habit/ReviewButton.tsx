'use client';

import { CalendarDays } from 'lucide-react';
import { useRef, useState } from 'react';
import { useToday } from '@/lib/useToday';
import { ReviewSheet } from './ReviewSheet';

/**
 * The header button that opens the review, and holds whether it is open.
 *
 * It waits for the client to know today's date, like everything else that
 * depends on it: the server cannot know the reader's timezone, so rendering a
 * calendar from the server's idea of "today" would be wrong for half the world.
 */
export function ReviewButton() {
  const today = useToday();
  const [open, setOpen] = useState(false);
  const buttonRef = useRef<HTMLButtonElement>(null);

  function close() {
    setOpen(false);
    buttonRef.current?.focus();
  }

  return (
    <>
      <button
        ref={buttonRef}
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Review the last 4 weeks"
        aria-haspopup="dialog"
        aria-expanded={open}
        disabled={today === null}
        className="grid h-11 w-11 shrink-0 touch-manipulation place-items-center rounded-full border border-line bg-card text-ink-soft transition active:scale-90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
      >
        <CalendarDays className="h-5 w-5" strokeWidth={2.5} />
      </button>

      {open && today && <ReviewSheet today={today} onClose={close} />}
    </>
  );
}
