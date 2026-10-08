import { addDaysToKey, parseDateKey } from './date';
import { isDueOn, parseSchedule, weekStart } from './schedule';
import type { Completion, CompletionKey, DateKey, Habit, HabibitState, Task } from './types';

/**
 * Sample habits: a believable couple of months, one tap away (v5 Block C).
 *
 * An empty habit tracker shows nothing of what it does. Streaks, the week
 * chart and a year of history need weeks of use before they mean anything, so
 * a first-time visitor is offered a made-up person's habits to look at — and
 * can clear them, or keep going with them, whenever they like.
 *
 * **Recognisable by id.** Every sample record's id comes from one reserved
 * block of UUIDs, so "clear the samples" removes exactly them and never
 * anything you added. They are real UUIDs on purpose: the database's id
 * column is a `uuid`, and a malformed id in an upload would fail the whole
 * batch, not just itself.
 *
 * **They never reach an account.** Signing in clears them first (your call,
 * at the start of the block), and the sync layer skips anything with a sample
 * id as a second line of defence. See `store/SyncProvider.tsx`.
 *
 * **Pure and the same every time.** The history is drawn from a seeded random
 * sequence relative to `today`, so the sample is always current, a test can
 * pin exactly what it contains, and two taps on the same day give the same
 * months. Every date step goes through `lib/date.ts`, which handles the
 * daylight-saving trap.
 */

/** The reserved block. Version 4, RFC 4122 variant — a real UUID shape. */
export const SAMPLE_ID_PREFIX = '5a3b1e00-0000-4000-8000-';

const sampleId = (n: number) => `${SAMPLE_ID_PREFIX}${n.toString(16).padStart(12, '0')}`;

export function isSampleId(id: string): boolean {
  return id.startsWith(SAMPLE_ID_PREFIX);
}

/**
 * Whether a sync outbox entry is about a sample record. The entries are
 * `habit:<id>`, `task:<id>` and `completion:<habitId>::<day>` (lib/sync/sync.ts).
 */
export function isSampleOutboxKey(key: string): boolean {
  return isSampleId(key.slice(key.indexOf(':') + 1));
}

/** Are any sample habits or tasks still here? Deleted ones don't count. */
export function hasSample(state: HabibitState): boolean {
  return (
    state.habits.some((h) => h.deletedAt === null && isSampleId(h.id)) ||
    state.tasks.some((t) => t.deletedAt === null && isSampleId(t.id))
  );
}

/**
 * Everything except the samples, tombstones of deleted samples included.
 *
 * Returns the very same object when there is nothing to remove. Signing in
 * clears the samples, and that also runs every time the app opens already
 * signed in; a fresh object each time would count as a change and rewrite
 * storage on every open for nothing.
 */
export function withoutSample(state: HabibitState): HabibitState {
  const entries = Object.entries(state.completions);
  const habits = state.habits.filter((h) => !isSampleId(h.id));
  const tasks = state.tasks.filter((t) => !isSampleId(t.id));
  const kept = entries.filter(([key]) => !isSampleId(key));
  if (habits.length === state.habits.length && tasks.length === state.tasks.length && kept.length === entries.length) {
    return state;
  }
  return { habits, tasks, completions: Object.fromEntries(kept) as HabibitState['completions'] };
}

type Plan = {
  title: string;
  icon: string;
  colour: string;
  schedule: string | null;
  /** How many days ago it was started. */
  started: number;
  /** How often it was kept, before the run at the end. */
  rate: number;
  /** The run of kept days (or weeks) leading up to yesterday. 0 = missed yesterday. */
  streak: number;
  /**
   * An older run, as [days ago it started, how long], ended by a miss — so the
   * best run ever isn't always the one going now, as in a real record.
   */
  pastRun?: [number, number];
  doneToday: boolean;
};

/*
 * One per colour, and each one shows off something different: a long streak,
 * a Mon/Wed/Fri habit, a habit started a month in (so the year view has blank
 * days before it, not misses), a few-times-a-week habit counted in weeks, and
 * a streak broken yesterday — because a believable record has misses in it.
 */
const PLANS: Plan[] = [
  { title: 'Drink water', icon: 'droplet', colour: 'blue', schedule: null, started: 70, rate: 0.9, streak: 23, doneToday: true },
  { title: 'Morning run', icon: 'footprints', colour: 'coral', schedule: 'weekdays:0,2,4', started: 70, rate: 0.85, streak: 7, doneToday: false },
  { title: 'Read 20 pages', icon: 'book-open', colour: 'violet', schedule: null, started: 66, rate: 0.75, streak: 6, doneToday: true, pastRun: [58, 31] },
  { title: 'Meditate', icon: 'brain', colour: 'green', schedule: null, started: 29, rate: 0.6, streak: 3, doneToday: false },
  { title: 'Gym', icon: 'dumbbell', colour: 'amber', schedule: 'weekly:3', started: 63, rate: 0.8, streak: 0, doneToday: false },
  { title: 'Sleep by 11', icon: 'moon', colour: 'teal', schedule: null, started: 50, rate: 0.65, streak: 0, doneToday: false },
];

const TASKS: { title: string; age: number; doneDaysAgo: number | null }[] = [
  { title: 'Book the dentist', age: 3, doneDaysAgo: null },
  { title: 'Renew passport', age: 9, doneDaysAgo: null },
  { title: 'Buy new running shoes', age: 12, doneDaysAgo: 1 },
];

/** mulberry32: small, fast, and the same sequence for the same seed everywhere. */
function seeded(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Fisher–Yates. Not `sort(() => random() - 0.5)`: that is biased, and its
 * result depends on the engine's sort algorithm, which would break "the same
 * sample every time" between browsers.
 */
function shuffle<T>(items: T[], random: () => number): T[] {
  const out = [...items];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

/** An instant on a local day, as stored. `minute` keeps creation order stable. */
function instant(day: DateKey, hour: number, minute = 0): string {
  const d = parseDateKey(day);
  d.setHours(hour, minute, 0, 0);
  return d.toISOString();
}

/** Which days, from `from` to `today`, this plan was kept on. */
function keptDays(plan: Plan, from: DateKey, today: DateKey, random: () => number): DateKey[] {
  const schedule = parseSchedule(plan.schedule);
  const kept: DateKey[] = [];

  if (schedule.kind === 'weekly') {
    // A few times a week: past weeks mostly meet the target, sometimes fall a
    // day short; this week so far has about half of its days done.
    for (let monday = weekStart(from); monday <= today; monday = addDaysToKey(monday, 7)) {
      const days = Array.from({ length: 7 }, (_, i) => addDaysToKey(monday, i)).filter((d) => d >= from && d < today);
      const thisWeek = addDaysToKey(monday, 6) >= today;
      const want = thisWeek ? Math.floor(days.length / 2) : random() < plan.rate ? schedule.times : schedule.times - 1;
      const shuffled = shuffle(days, random);
      kept.push(...shuffled.slice(0, Math.min(want, days.length)));
    }
    return kept.sort();
  }

  // Every due day from the start to yesterday, newest last.
  const due: DateKey[] = [];
  for (let day = from; day < today; day = addDaysToKey(day, 1)) if (isDueOn(schedule, day)) due.push(day);

  const runFrom = due.length - plan.streak;
  const [pastStart, pastLength] = plan.pastRun ?? [0, 0];
  const pastFirst = addDaysToKey(today, -pastStart);
  const pastLast = addDaysToKey(pastFirst, pastLength - 1);
  // A miss on each side, so the run is exactly as long as planned: otherwise
  // random ticks next to it join on (it came out 39 days, not 31, the first time).
  const pastBefore = addDaysToKey(pastFirst, -1);
  const pastEnd = addDaysToKey(pastLast, 1);
  due.forEach((day, i) => {
    if (i >= runFrom) kept.push(day); // the run at the end
    else if (i === runFrom - 1) return; // the miss that started it
    else if (pastLength > 0 && day >= pastFirst && day <= pastLast) kept.push(day); // an older run
    else if (pastLength > 0 && (day === pastEnd || day === pastBefore)) return; // and the misses either side
    else if (random() < plan.rate) kept.push(day);
  });
  if (plan.doneToday && isDueOn(schedule, today)) kept.push(today);
  return kept;
}

/**
 * The sample, as it would look on `today`: six habits about ten weeks deep,
 * and three tasks.
 */
export function sampleState(today: DateKey): HabibitState {
  const habits: Habit[] = [];
  const completions: Record<CompletionKey, Completion> = {};

  PLANS.forEach((plan, i) => {
    const id = sampleId(i + 1);
    const from = addDaysToKey(today, -plan.started);
    const created = instant(from, 8, i);
    habits.push({
      id,
      title: plan.title,
      createdAt: created,
      updatedAt: created,
      archivedAt: null,
      deletedAt: null,
      // Oldest first, by creation minute: no order keys needed until someone arranges.
      position: null,
      schedule: plan.schedule,
      icon: plan.icon,
      colour: plan.colour,
    });
    for (const day of keptDays(plan, from, today, seeded(0x5a3b1e + i))) {
      completions[`${id}::${day}`] = { done: true, updatedAt: instant(day, 20, i) };
    }
  });

  const tasks: Task[] = TASKS.map((t, i) => {
    const created = instant(addDaysToKey(today, -t.age), 9, i);
    const completedAt = t.doneDaysAgo === null ? null : instant(addDaysToKey(today, -t.doneDaysAgo), 18, i);
    return {
      id: sampleId(0x100 + i),
      title: t.title,
      createdAt: created,
      updatedAt: completedAt ?? created,
      completedAt,
      deletedAt: null,
    };
  });

  return { habits, tasks, completions };
}

/** Exposed for tests that need to know a plan's shape without re-deriving it. */
export const SAMPLE_PLANS: readonly Readonly<Plan>[] = PLANS;
