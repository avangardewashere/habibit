import { Plus, Sparkles } from 'lucide-react';
import { HabitIcon } from '@/components/habit/HabitIcon';
import { HUE_BG } from '@/components/ui/hue';
import type { HabitColour, HabitIcon as HabitIconName } from '@/lib/look';

/** The faces in the picture: four habits, four colours, the app at a glance. */
const FACES: { icon: HabitIconName; colour: HabitColour }[] = [
  { icon: 'droplet', colour: 'blue' },
  { icon: 'footprints', colour: 'coral' },
  { icon: 'book-open', colour: 'violet' },
  { icon: 'moon', colour: 'teal' },
];

/** Small, common, and each guesses a good icon (lib/look.ts). */
export const STARTERS = ['Drink water', 'Read', 'Walk', 'Meditate', 'Stretch', 'Sleep early'] as const;

/**
 * What an empty Habibit opens on (v5 Block C), in place of "No habits yet".
 *
 * Two ways in, your choice at the start of the block: **see it** with a
 * made-up couple of months, or **start your own** from a few common habits —
 * or by typing one into the box below, which is still there.
 *
 * The sample button is left out once you are signed in. Sample habits never
 * reach an account (lib/sample.ts), and offering something that would be
 * cleared the moment it arrived would be a trick.
 */
export function Welcome({
  canSample,
  onSample,
  onStart,
}: {
  canSample: boolean;
  onSample: () => void;
  onStart: (title: string) => void;
}) {
  return (
    <div className="px-5 pb-6 pt-7 text-center">
      <div aria-hidden className="mb-5 flex justify-center -space-x-2.5">
        {FACES.map(({ icon, colour }, i) => (
          <span
            key={icon}
            className={`grid h-12 w-12 place-items-center rounded-full border-4 border-card text-on-hue motion-safe:animate-float ${HUE_BG[colour]}`}
            style={{ animationDelay: `${i * -0.85}s` }}
          >
            <HabitIcon name={icon} className="h-5 w-5" />
          </span>
        ))}
      </div>

      <h2 className="text-2xl font-extrabold tracking-tight text-ink">Small habits, kept daily.</h2>
      <p className="mx-auto mt-2 max-w-xs text-sm leading-relaxed text-ink-soft">
        Tick a habit each day you do it. Habibit counts the streak, charts your week and keeps a year
        of history — on this device, no account needed.
      </p>

      {canSample && (
        <button
          type="button"
          onClick={onSample}
          /*
           * The all-done badge's pair, not the accent's: this is text, and white
           * on the light accent is 3.39:1 (lib/contrast.test.ts).
           */
          className="mt-5 inline-flex min-h-12 w-full touch-manipulation items-center justify-center gap-2 rounded-full bg-badge-done-bg px-5 text-[15px] font-extrabold text-badge-done-fg transition active:scale-[0.98] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
        >
          <Sparkles aria-hidden className="h-4 w-4" strokeWidth={2.5} />
          See it with sample habits
        </button>
      )}

      <p className="mt-6 text-xs font-bold uppercase tracking-wide text-ink-soft">
        {canSample ? 'Or start your own' : 'Start with one of these'}
      </p>
      <ul className="mt-2 flex flex-wrap justify-center gap-2">
        {STARTERS.map((title) => (
          <li key={title}>
            <button
              type="button"
              onClick={() => onStart(title)}
              aria-label={`Add ${title}`}
              className="inline-flex min-h-11 touch-manipulation items-center gap-1 rounded-full border border-ink-soft bg-card px-4 text-sm font-bold text-ink transition active:scale-95 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
            >
              <Plus aria-hidden className="h-4 w-4 text-ink-soft" strokeWidth={2.5} />
              {title}
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
