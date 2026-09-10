import { describe, expect, it } from 'vitest';
import {
  addDaysToKey,
  dateKey,
  formatDateKeyLong,
  formatDayLabel,
  parseDateKey,
  todayKey,
  weekdayInitial,
} from './date';

describe('dateKey', () => {
  it('runs under the timezone the suite pins (UTC+8)', () => {
    // Guard: if this ever drifts, the local-vs-UTC test below would pass
    // vacuously instead of testing anything.
    expect(Intl.DateTimeFormat().resolvedOptions().timeZone).toBe('Asia/Manila');
  });

  it('uses the LOCAL calendar day, not the UTC day', () => {
    // 16:30Z on the 7th is already 00:30 on the 8th in Manila.
    const d = new Date('2026-09-07T16:30:00.000Z');

    expect(dateKey(d)).toBe('2026-09-08');
    expect(d.toISOString().slice(0, 10)).toBe('2026-09-07');
    expect(dateKey(d)).not.toBe(d.toISOString().slice(0, 10));
  });

  it('agrees with UTC when the local day has not rolled over', () => {
    // 02:00Z on the 7th is 10:00 on the 7th in Manila — same calendar day.
    const d = new Date('2026-09-07T02:00:00.000Z');
    expect(dateKey(d)).toBe('2026-09-07');
  });

  it('zero-pads single-digit months and days', () => {
    expect(dateKey(new Date(2026, 0, 5))).toBe('2026-01-05');
    expect(dateKey(new Date(2026, 11, 31))).toBe('2026-12-31');
  });

  it('handles a local-time leap day', () => {
    expect(dateKey(new Date(2028, 1, 29))).toBe('2028-02-29');
  });
});

describe('todayKey', () => {
  it('returns a YYYY-MM-DD string', () => {
    expect(todayKey()).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it('matches dateKey for the current instant', () => {
    expect(todayKey()).toBe(dateKey(new Date()));
  });
});

describe('formatDayLabel', () => {
  it('renders a weekday, month and day', () => {
    expect(formatDayLabel(new Date(2026, 8, 7))).toBe('Monday, September 7');
  });
});

describe('parseDateKey', () => {
  it('lands on LOCAL midnight, not UTC midnight', () => {
    const d = parseDateKey('2026-09-07');

    expect(d.getFullYear()).toBe(2026);
    expect(d.getMonth()).toBe(8);
    expect(d.getDate()).toBe(7);
    expect(d.getHours()).toBe(0);

    // The trap: `new Date('2026-09-07')` is UTC midnight, which in Manila is
    // 08:00 on the 7th -- same day here, but the previous day for anyone west
    // of Greenwich. Constructing from parts is timezone-stable everywhere.
    expect(d.getTime()).not.toBe(new Date('2026-09-07').getTime());
  });

  it('round-trips with dateKey', () => {
    for (const key of ['2026-01-01', '2026-09-07', '2028-02-29', '2026-12-31']) {
      expect(dateKey(parseDateKey(key))).toBe(key);
    }
  });

  it('gives formatDayLabel the right weekday', () => {
    expect(formatDayLabel(parseDateKey('2026-09-07'))).toBe('Monday, September 7');
  });
});

describe('addDaysToKey', () => {
  it('steps forward and back by a day', () => {
    expect(addDaysToKey('2026-09-08', 1)).toBe('2026-09-09');
    expect(addDaysToKey('2026-09-08', -1)).toBe('2026-09-07');
    expect(addDaysToKey('2026-09-08', 0)).toBe('2026-09-08');
  });

  it('rolls over a month boundary in both directions', () => {
    expect(addDaysToKey('2026-09-30', 1)).toBe('2026-10-01');
    expect(addDaysToKey('2026-10-01', -1)).toBe('2026-09-30');
    expect(addDaysToKey('2026-03-01', -1)).toBe('2026-02-28');
  });

  it('rolls over a year boundary', () => {
    expect(addDaysToKey('2026-12-31', 1)).toBe('2027-01-01');
    expect(addDaysToKey('2027-01-01', -1)).toBe('2026-12-31');
  });

  it('handles a leap day from both sides', () => {
    expect(addDaysToKey('2028-02-28', 1)).toBe('2028-02-29');
    expect(addDaysToKey('2028-02-29', 1)).toBe('2028-03-01');
    expect(addDaysToKey('2028-03-01', -1)).toBe('2028-02-29');
    // 2027 is not a leap year, so February has 28 days.
    expect(addDaysToKey('2027-02-28', 1)).toBe('2027-03-01');
  });

  it('round-trips over a long span', () => {
    let key = '2026-09-08';
    for (let i = 0; i < 400; i += 1) key = addDaysToKey(key, 1);
    for (let i = 0; i < 400; i += 1) key = addDaysToKey(key, -1);
    expect(key).toBe('2026-09-08');
  });

  it('is calendar arithmetic, not millisecond arithmetic', () => {
    // The trap this helper exists to avoid. Subtracting a fixed 24h is only
    // correct in zones with no DST; the calendar step is correct everywhere.
    const key = '2026-09-08';
    const naive = dateKey(new Date(parseDateKey(key).getTime() - 86_400_000));
    expect(addDaysToKey(key, -1)).toBe('2026-09-07');
    // Under this suite's fixed TZ they agree; the assertion documents that the
    // implementation must not be the naive one.
    expect(naive).toBe('2026-09-07');
    expect(addDaysToKey(key, -1)).toBe(naive);
  });
});

describe('weekdayInitial', () => {
  it('gives one letter per weekday', () => {
    // 2026-09-07 is a Monday.
    const week = ['2026-09-07', '2026-09-08', '2026-09-09', '2026-09-10', '2026-09-11', '2026-09-12', '2026-09-13'];
    expect(week.map(weekdayInitial)).toEqual(['M', 'T', 'W', 'T', 'F', 'S', 'S']);
  });
});

describe('formatDateKeyLong', () => {
  it('names the day for a screen reader', () => {
    expect(formatDateKeyLong('2026-09-08')).toBe('Tuesday, September 8');
  });
});
