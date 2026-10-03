import { formatDateKeyLong, weekdayInitial } from '@/lib/date';
import type { DateKey } from '@/lib/types';
import type { WeekSummary } from '@/store/selectors';

/**
 * This week at a glance: how many habits were kept out of how many could have
 * been, and a bar per day from Monday (v5 Block B).
 *
 * Three kinds of day, drawn three ways, because they mean three things:
 *
 * - a day so far, filled to the share of habits kept (today included — it is
 *   the bar people watch fill up);
 * - a day with **nothing due**, drawn as a rest day with a short dash, not as
 *   an empty bar — a Saturday off is not a Saturday failed;
 * - a day still to come, a dashed outline: nothing to say yet.
 *
 * The bars are a picture and hidden from screen readers; the sentence above
 * them says the same in words, day by day.
 */
export function WeekCard({ summary, today }: { summary: WeekSummary; today: DateKey }) {
  const { days, done, due } = summary;
  const percent = due > 0 ? Math.round((done / due) * 100) : null;

  const spoken = days
    .filter((d) => !d.future)
    .map((d) => `${formatDateKeyLong(d.day)}: ${d.due === 0 ? 'nothing due' : `${d.done} of ${d.due}`}`)
    .join('; ');

  return (
    <section aria-labelledby="week-heading" className="rounded-card border border-line bg-card p-4">
      <div className="flex items-baseline justify-between gap-3">
        <h2 id="week-heading" className="text-xs font-bold uppercase tracking-wide text-ink-soft">
          This week
        </h2>
        {percent !== null && <p className="text-xs font-extrabold tabular-nums text-ink-soft">{percent}% kept</p>}
      </div>

      <p className="mt-1 text-3xl font-extrabold tabular-nums tracking-tight text-ink">
        {done}
        <span className="text-lg text-ink-soft"> / {due}</span>
      </p>
      <p className="text-sm text-ink-soft">{due === 0 ? 'Nothing due yet this week' : 'habits kept so far'}</p>
      <p className="sr-only">{spoken}</p>

      <div aria-hidden className="mt-4 grid grid-cols-7 gap-2">
        {days.map((d, i) => {
          const isToday = d.day === today;
          const share = d.due > 0 ? d.done / d.due : 0;
          const full = d.due > 0 && d.done === d.due;
          return (
            <div key={d.day} className="flex flex-col items-center gap-1.5" data-week-day={d.day}>
              <div
                className={[
                  'relative flex h-24 w-full items-end justify-center overflow-hidden rounded-lg',
                  d.future ? 'border-2 border-dashed border-line' : 'bg-line',
                  isToday ? 'ring-2 ring-accent ring-offset-2 ring-offset-card' : '',
                ].join(' ')}
              >
                {!d.future && d.due === 0 && (
                  // A rest day: a short dash at the baseline, so it is visibly
                  // a different thing from a day where nothing got done.
                  <span data-bar="rest" className="mb-2 h-1 w-3 rounded-full bg-ink-soft opacity-60" />
                )}
                {!d.future && d.due > 0 && (
                  <span
                    data-bar={full ? 'full' : 'part'}
                    className={[
                      'block w-full origin-bottom animate-grow rounded-lg motion-reduce:animate-none',
                      full ? 'bg-badge-done-bg' : 'bg-accent',
                    ].join(' ')}
                    // A sliver even at zero would read as "a little done"; a
                    // missed day stays empty and its grey track says so.
                    style={{ height: `${share * 100}%`, animationDelay: `${i * 55}ms` }}
                  />
                )}
              </div>
              <span className={`text-[11px] font-extrabold uppercase ${isToday ? 'text-ink' : 'text-ink-soft'}`}>
                {weekdayInitial(d.day)}
              </span>
            </div>
          );
        })}
      </div>
    </section>
  );
}
