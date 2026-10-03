import { describe, expect, it } from 'vitest';
import type { DateKey, Habit, HabibitState } from '@/lib/types';
import { bestRunEver, checkIns, habitStreak, longestGoing, weekSummary } from './selectors';

/*
 * v5 Block B: the numbers on the Progress tab.
 *
 * The promise these keep is that Progress can never disagree with Today. None
 * of it is new arithmetic — it goes through `reviewDay`, `habitStreak` and
 * `bestEver` — and V5B-17 checks the one place a reader would compare them
 * side by side.
 *
 * 2026-10-07 is a Wednesday, so this week is Mon 5th to Sun 11th and "so far"
 * is three days.
 */
const TODAY: DateKey = '2026-10-07';
const CREATED = '2026-09-01T02:00:00.000Z';

function habit(id: string, over: Partial<Habit> = {}): Habit {
  return {
    id,
    title: id,
    createdAt: CREATED,
    updatedAt: CREATED,
    archivedAt: null,
    deletedAt: null,
    position: null,
    schedule: null,
    icon: null,
    colour: null,
    ...over,
  };
}

function state(habits: Habit[], ticks: [string, DateKey][], unticks: [string, DateKey][] = []): HabibitState {
  const at = '2026-10-07T00:00:00.000Z';
  return {
    habits,
    tasks: [],
    completions: Object.fromEntries([
      ...ticks.map(([id, day]) => [`${id}::${day}`, { done: true, updatedAt: at }]),
      ...unticks.map(([id, day]) => [`${id}::${day}`, { done: false, updatedAt: at }]),
    ]) as HabibitState['completions'],
  };
}

describe('V5B: this week', () => {
  it('V5B-10 · ⭐ counts each day so far, Monday first, and leaves the rest of the week empty', () => {
    const s = state([habit('a'), habit('b')], [
      ['a', '2026-10-05'], ['b', '2026-10-05'],
      ['a', '2026-10-06'],
    ]);
    const week = weekSummary(s, TODAY);

    expect(week.days.map((d) => d.day)).toEqual([
      '2026-10-05', '2026-10-06', '2026-10-07', '2026-10-08', '2026-10-09', '2026-10-10', '2026-10-11',
    ]);
    expect(week.days.slice(0, 3).map((d) => [d.done, d.due])).toEqual([[2, 2], [1, 2], [0, 2]]);
    expect(week.days.slice(3).every((d) => d.future && d.due === 0 && d.done === 0)).toBe(true);
    expect([week.done, week.due]).toEqual([3, 6]);
  });

  it('V5B-11 · ⭐ a day with nothing due is a rest day, not a zero out of something', () => {
    // Mon/Wed/Fri: Tuesday the 6th has nothing due.
    const s = state([habit('run', { schedule: 'weekdays:0,2,4' })], [['run', '2026-10-05']]);
    const tuesday = weekSummary(s, TODAY).days[1];

    expect(tuesday).toMatchObject({ due: 0, done: 0, future: false });
  });

  it('V5B-12 · a habit kept on a day it wasn’t due still counts, as everywhere else', () => {
    const s = state([habit('run', { schedule: 'weekdays:0,2,4' })], [['run', '2026-10-06']]);
    expect(weekSummary(s, TODAY).days[1]).toMatchObject({ due: 1, done: 1 });
  });

  it('V5B-13 · days before a habit existed are not held against it', () => {
    const s = state([habit('new', { createdAt: '2026-10-06T02:00:00.000Z' })], []);
    expect(weekSummary(s, TODAY).days.slice(0, 3).map((d) => d.due)).toEqual([0, 1, 1]);
  });

  it('V5B-14 · archived and deleted habits are left out, as they are on Today', () => {
    const s = state(
      [habit('a'), habit('shelf', { archivedAt: CREATED }), habit('gone', { deletedAt: CREATED })],
      [['shelf', '2026-10-05'], ['gone', '2026-10-05']],
    );
    expect(weekSummary(s, TODAY).days[0]).toMatchObject({ due: 1, done: 0 });
  });

  it('V5B-15 · an untick is not a tick', () => {
    const s = state([habit('a')], [], [['a', '2026-10-05']]);
    expect(weekSummary(s, TODAY).days[0]).toMatchObject({ due: 1, done: 0 });
  });
});

describe('V5B: the highlights', () => {
  it('V5B-16 · ⭐ the longest streak going, and whose it is', () => {
    const s = state([habit('short'), habit('long')], [
      ['short', '2026-10-06'], ['short', '2026-10-07'],
      ['long', '2026-10-03'], ['long', '2026-10-04'], ['long', '2026-10-05'], ['long', '2026-10-06'], ['long', '2026-10-07'],
    ]);
    const going = longestGoing(s, TODAY);

    expect(going?.habit.id).toBe('long');
    expect(going?.streak).toEqual({ count: 5, unit: 'day' });
  });

  it('V5B-17 · ⭐ it is exactly the badge Today shows for that habit', () => {
    const s = state([habit('a', { schedule: 'weekdays:0,2,4' })], [
      ['a', '2026-09-28'], ['a', '2026-09-30'], ['a', '2026-10-02'], ['a', '2026-10-05'], ['a', '2026-10-07'],
    ]);
    const going = longestGoing(s, TODAY)!;
    expect(going.streak).toEqual(habitStreak(s, going.habit, TODAY));
  });

  it('V5B-18 · ⭐ a streak in weeks outranks a shorter one in days', () => {
    // Three weeks of a twice-a-week habit beats ten days of a daily one.
    const weekly = habit('gym', { schedule: 'weekly:2' });
    const ticks: [string, DateKey][] = [
      ['gym', '2026-09-21'], ['gym', '2026-09-23'],
      ['gym', '2026-09-28'], ['gym', '2026-09-30'],
      ['gym', '2026-10-05'], ['gym', '2026-10-06'],
    ];
    for (let d = 28; d <= 30; d++) ticks.push(['daily', `2026-09-${d}`]);
    for (let d = 1; d <= 7; d++) ticks.push(['daily', `2026-10-0${d}`]);
    const going = longestGoing(state([habit('daily'), weekly], ticks), TODAY);

    expect(going?.habit.id).toBe('gym');
    expect(going?.streak.unit).toBe('week');
  });

  it('V5B-19 · ⭐ no streaks at all is "none", not a habit with zero', () => {
    const s = state([habit('a')], []);
    expect(longestGoing(s, TODAY)).toBeNull();
    expect(bestRunEver(s, TODAY)).toBeNull();
  });

  it('V5B-20 · the best run ever can be long over', () => {
    const ticks: [string, DateKey][] = [];
    for (let d = 10; d <= 19; d++) ticks.push(['a', `2026-09-${d}`]);
    ticks.push(['a', '2026-10-07']);
    const best = bestRunEver(state([habit('a')], ticks), TODAY);

    expect(best?.streak).toEqual({ count: 10, unit: 'day' });
  });

  it('V5B-21 · ⭐ check-ins: every tick of every habit you still have, archived ones included', () => {
    const s = state(
      [habit('a'), habit('shelf', { archivedAt: CREATED }), habit('gone', { deletedAt: CREATED })],
      [
        ['a', '2026-10-05'], ['a', '2026-10-06'],
        ['shelf', '2026-09-10'],
        ['gone', '2026-10-05'],          // deleted: gone with its habit
        ['a', '2026-10-09'],             // dated after today: a clock that ran ahead
      ],
      [['a', '2026-10-07']],             // unticked: not a check-in
    );
    expect(checkIns(s, TODAY)).toBe(3);
  });
});
