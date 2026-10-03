import { CheckCheck, Flame, Trophy, type LucideIcon } from 'lucide-react';
import { HUE_BG } from '@/components/ui/hue';
import { resolveColour } from '@/lib/look';
import type { Standout } from '@/store/selectors';

/**
 * The three numbers worth being pleased about (v5 Block B): the longest streak
 * running now, the best run there has ever been, and every tick there has ever
 * been.
 *
 * The two streaks say **whose** they are, with that habit's colour on the
 * icon, because "12 days" on its own invites the question "of what?".
 */
export function Highlights({
  going,
  best,
  checkIns,
}: {
  going: Standout | null;
  best: Standout | null;
  checkIns: number;
}) {
  return (
    <section aria-label="Highlights" className="grid grid-cols-3 gap-2">
      <Tile
        Icon={Flame}
        label="Streak going"
        standout={going}
        empty="Tick a habit to start one"
      />
      <Tile Icon={Trophy} label="Best run ever" standout={best} empty="Your best run goes here" />
      <div className="flex min-w-0 flex-col rounded-card border border-line bg-card p-3">
        <span aria-hidden className="grid h-7 w-7 place-items-center rounded-full bg-accent text-on-accent">
          <CheckCheck className="h-4 w-4" strokeWidth={2.75} />
        </span>
        <p className="mt-2 text-2xl font-extrabold tabular-nums leading-none tracking-tight text-ink">
          {checkIns.toLocaleString('en-US')}
        </p>
        <p className="mt-1 text-[11px] font-bold uppercase tracking-wide text-ink-soft">Check-ins</p>
        <p className="mt-0.5 truncate text-xs text-ink-soft">all time</p>
      </div>
    </section>
  );
}

function Tile({
  Icon,
  label,
  standout,
  empty,
}: {
  Icon: LucideIcon;
  label: string;
  standout: Standout | null;
  empty: string;
}) {
  const colour = standout ? resolveColour(standout.habit.colour, standout.habit.id) : null;
  const count = standout?.streak.count ?? 0;
  const unit = standout?.streak.unit ?? 'day';

  return (
    <div className="flex min-w-0 flex-col rounded-card border border-line bg-card p-3">
      <span
        aria-hidden
        className={`grid h-7 w-7 place-items-center rounded-full text-on-hue ${colour ? HUE_BG[colour] : 'bg-ink-soft'}`}
      >
        <Icon className="h-4 w-4" strokeWidth={2.75} />
      </span>
      <p className="mt-2 text-2xl font-extrabold tabular-nums leading-none tracking-tight text-ink">
        {count}
        <span className="ml-1 text-xs font-bold text-ink-soft">
          {unit}
          {count === 1 ? '' : 's'}
        </span>
      </p>
      <p className="mt-1 text-[11px] font-bold uppercase tracking-wide text-ink-soft">{label}</p>
      <p className="mt-0.5 truncate text-xs text-ink-soft" title={standout?.habit.title}>
        {standout ? standout.habit.title : empty}
      </p>
    </div>
  );
}
