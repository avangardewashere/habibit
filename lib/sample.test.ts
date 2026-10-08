import { describe, expect, it } from 'vitest';
import { isStoredLook, parseColour, parseIcon } from './look';
import {
  SAMPLE_PLANS,
  hasSample,
  isSampleId,
  isSampleOutboxKey,
  sampleState,
  withoutSample,
} from './sample';
import { isStoredSchedule } from './schedule';
import { isHabibitState } from './storage';
import type { HabibitState } from './types';
import { bestEver, bestRunEver, habitStreak, isDue, longestGoing } from '@/store/selectors';

/*
 * v5 Block C: the sample a first-time visitor can load.
 *
 * What it has to be: always about *now* (generated from today), never ahead
 * of today, the same every time, made only of things this build can draw and
 * store — and recognisable, so it can be cleared without touching anything
 * else and kept out of every account.
 *
 * 2026-10-07 is a Wednesday.
 */
const TODAY = '2026-10-07';
const sample = sampleState(TODAY);
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

describe('V5C: what the sample is', () => {
  it('V5C-01 · ⭐ six habits, one per colour, and three tasks', () => {
    expect(sample.habits).toHaveLength(6);
    expect(new Set(sample.habits.map((h) => h.colour)).size).toBe(6);
    expect(sample.tasks).toHaveLength(3);
  });

  it('V5C-02 · ⭐ every id is a real UUID from the reserved block', () => {
    // A real UUID because the database column is one — a malformed id would
    // fail an upload's whole batch, not just itself.
    for (const record of [...sample.habits, ...sample.tasks]) {
      expect(record.id, record.id).toMatch(UUID);
      expect(isSampleId(record.id)).toBe(true);
    }
    expect(new Set([...sample.habits, ...sample.tasks].map((r) => r.id)).size).toBe(9);
  });

  it('V5C-03 · ⭐ it is a valid state, as storage would read it back', () => {
    expect(isHabibitState(sample)).toBe(true);
  });

  it('V5C-04 · every look and schedule is one this build can draw and store', () => {
    for (const h of sample.habits) {
      expect(parseIcon(h.icon), h.title).not.toBeNull();
      expect(parseColour(h.colour), h.title).not.toBeNull();
      expect(isStoredLook(h.icon) && isStoredLook(h.colour)).toBe(true);
      expect(isStoredSchedule(h.schedule), h.title).toBe(true);
    }
  });

  it('V5C-05 · ⭐ nothing is dated after today, and every habit has weeks of history', () => {
    for (const key of Object.keys(sample.completions)) {
      expect(key.slice(key.lastIndexOf('::') + 2) <= TODAY, key).toBe(true);
    }
    for (const h of sample.habits) {
      const ticks = Object.keys(sample.completions).filter((k) => k.startsWith(`${h.id}::`));
      expect(ticks.length, h.title).toBeGreaterThanOrEqual(8);
    }
  });

  it('V5C-06 · ⭐ the same day always gives the same sample', () => {
    expect(sampleState(TODAY)).toEqual(sample);
  });

  it('V5C-07 · ⭐ it moves with the calendar: a later day gives a later sample, not an old one', () => {
    const later = sampleState('2027-03-15');
    const days = Object.keys(later.completions).map((k) => k.slice(k.lastIndexOf('::') + 2));
    expect(days.some((d) => d > '2027-03-01')).toBe(true);
    expect(days.every((d) => d <= '2027-03-15')).toBe(true);
  });

  it('V5C-08 · ⭐ the record reads as a person’s: a long streak, a fresh miss, and a habit started later', () => {
    const byTitle = (title: string) => sample.habits.find((h) => h.title === title)!;
    expect(habitStreak(sample, byTitle('Drink water'), TODAY)).toEqual({ count: 24, unit: 'day' });
    // Missed yesterday, on purpose: a record with no misses isn't believable.
    expect(habitStreak(sample, byTitle('Sleep by 11'), TODAY).count).toBe(0);
    expect(bestEver(sample, byTitle('Sleep by 11'), TODAY).count).toBeGreaterThan(0);
    // Started a month in, so the year view shows blank days before it, not misses.
    expect(byTitle('Meditate').createdAt > byTitle('Drink water').createdAt).toBe(true);
    // Counted in weeks, like any few-times-a-week habit.
    expect(habitStreak(sample, byTitle('Gym'), TODAY).unit).toBe('week');
  });

  it('V5C-16 · ⭐ the best run ever is an older one, not the streak going now', () => {
    // Otherwise Progress shows the same habit and number twice in a row of three.
    const going = longestGoing(sample, TODAY)!;
    const best = bestRunEver(sample, TODAY)!;
    expect(going.habit.title).toBe('Drink water');
    expect(best.habit.title).toBe('Read 20 pages');
    expect(best.streak).toEqual({ count: 31, unit: 'day' });
    expect(best.streak.count).toBeGreaterThan(going.streak.count);
  });

  it('V5C-09 · a habit is never ticked on a day it wasn’t due — except the weekly one, which has no fixed days', () => {
    for (const h of sample.habits.filter((x) => x.schedule?.startsWith('weekdays'))) {
      for (const key of Object.keys(sample.completions).filter((k) => k.startsWith(`${h.id}::`))) {
        const day = key.slice(key.lastIndexOf('::') + 2);
        expect(isDue(sample, h, day), `${h.title} ${day}`).toBe(true);
      }
    }
  });

  it('V5C-10 · today is part-done, so Today has something left to tick', () => {
    const doneToday = sample.habits.filter((h) => sample.completions[`${h.id}::${TODAY}`]?.done).length;
    expect(doneToday).toBeGreaterThan(0);
    expect(doneToday).toBeLessThan(sample.habits.length);
  });

  it('V5C-11 · the plans listed are the habits made', () => {
    expect(sample.habits.map((h) => h.title)).toEqual(SAMPLE_PLANS.map((p) => p.title));
  });
});

describe('V5C: telling sample from yours', () => {
  const mine: HabibitState = {
    habits: [{ ...sample.habits[0], id: '11111111-2222-4333-8444-555555555555', title: 'Mine' }],
    tasks: [],
    completions: { '11111111-2222-4333-8444-555555555555::2026-10-07': { done: true, updatedAt: '2026-10-07T00:00:00.000Z' } },
  };
  const both: HabibitState = {
    habits: [...mine.habits, ...sample.habits],
    tasks: sample.tasks,
    completions: { ...mine.completions, ...sample.completions },
  };

  it('V5C-12 · ⭐ removing the sample leaves exactly what was yours', () => {
    expect(withoutSample(both)).toEqual(mine);
  });

  it('V5C-13 · ⭐ with no sample there, it hands back the very same state', () => {
    // So clearing on every signed-in app open doesn't rewrite storage for nothing.
    expect(withoutSample(mine)).toBe(mine);
  });

  it('V5C-14 · deleted samples don’t count as samples still here', () => {
    const deleted = { ...sample, habits: sample.habits.map((h) => ({ ...h, deletedAt: h.createdAt })), tasks: [] };
    expect(hasSample(deleted)).toBe(false);
    expect(hasSample(sample)).toBe(true);
    expect(hasSample(mine)).toBe(false);
  });

  it('V5C-15 · ⭐ every kind of sync outbox entry for a sample is recognised, and nothing else is', () => {
    const id = sample.habits[0].id;
    expect(isSampleOutboxKey(`habit:${id}`)).toBe(true);
    expect(isSampleOutboxKey(`task:${sample.tasks[0].id}`)).toBe(true);
    expect(isSampleOutboxKey(`completion:${id}::2026-10-07`)).toBe(true);
    expect(isSampleOutboxKey('habit:11111111-2222-4333-8444-555555555555')).toBe(false);
    expect(isSampleOutboxKey('completion:11111111-2222-4333-8444-555555555555::2026-10-07')).toBe(false);
  });
});
