import { Check } from 'lucide-react';
import type { ReactNode } from 'react';
import type { HabitColour } from '@/lib/look';
import { HUE_BG, HUE_BORDER, HUE_TEXT } from './hue';

/**
 * The check control, shared by habits and tasks.
 *
 * Presentational only — the surrounding row owns the button semantics, so this
 * is hidden from assistive tech to avoid announcing the state twice.
 *
 * Since v5 Block A a habit brings a `colour` and a `glyph` with it, and the
 * circle is where they live: the ring and the icon when it is not done, the
 * fill when it is. Tasks pass neither and look exactly as they did.
 *
 * **Colour is never the signal.** Done is a filled circle with a tick and not
 * done is a ring, in both cases, so the state survives being read in grayscale
 * or by someone who cannot tell teal from green. The colour says *which habit*,
 * not *whether*.
 *
 * `glyph` is a node rather than an icon name so this file stays generic and the
 * icon set is imported only by the habit components that actually need it.
 */
export function CheckCircle({
  checked,
  colour = null,
  glyph,
}: {
  checked: boolean;
  colour?: HabitColour | null;
  /** Shown inside the circle when it is not checked. Tasks have none. */
  glyph?: ReactNode;
}) {
  const filled = colour ? `${HUE_BORDER[colour]} ${HUE_BG[colour]} text-on-hue` : 'border-accent bg-accent text-on-accent';
  const empty = colour ? `${HUE_BORDER[colour]} bg-card ${HUE_TEXT[colour]}` : 'border-line bg-card text-transparent';

  return (
    <span
      aria-hidden
      className={[
        'grid h-7 w-7 shrink-0 place-items-center rounded-full border-2 transition-all duration-150',
        checked ? `scale-100 ${filled}` : empty,
      ].join(' ')}
    >
      {inside(checked, colour, glyph)}
    </span>
  );
}

/**
 * What sits inside the circle.
 *
 * The unchecked tick is not decoration to be dropped casually: for a task it is
 * drawn `text-transparent`, so it keeps the circle's layout and fades in when
 * ticked. A habit's empty circle is drawn in the habit's own colour instead —
 * so the same invisible tick would turn into a **visible** one, and a habit
 * with no icon would look done when it isn't. Found by V5A-74 in a real
 * browser; no unit test was looking at what an empty coloured circle contains.
 */
function inside(checked: boolean, colour: HabitColour | null, glyph: ReactNode) {
  if (checked) return <Check className="h-4 w-4" strokeWidth={3.5} />;
  if (glyph) return glyph;
  if (colour) return null;
  return <Check className="h-4 w-4" strokeWidth={3.5} />;
}
