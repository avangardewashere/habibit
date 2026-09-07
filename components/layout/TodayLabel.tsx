'use client';

import { formatDayLabel, parseDateKey } from '@/lib/date';
import { useToday } from '@/lib/useToday';

/**
 * Today's date, resolved on the client only.
 *
 * The server cannot know the visitor's timezone, so server-rendering a date
 * would hand a hydration mismatch to anyone not on the server's clock. We
 * render a non-breaking space first — holding the line's height so there is no
 * layout shift — and fill in the real day once mounted.
 */
export function TodayLabel() {
  const today = useToday();

  return (
    <p className="mt-3 text-sm font-semibold text-ink-soft">
      {today ? formatDayLabel(parseDateKey(today)) : ' '}
    </p>
  );
}
