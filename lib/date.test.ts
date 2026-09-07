import { describe, expect, it } from 'vitest';
import { dateKey, formatDayLabel, parseDateKey, todayKey } from './date';

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
