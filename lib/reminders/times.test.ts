import { describe, expect, it } from 'vitest';
import {
  DEFAULT_REMINDER_TIME,
  deviceTimezone,
  formatReminderTime,
  isReminderTime,
  reminderTimes,
  toReminderTime,
} from './times';

describe('the times a reminder can be set to', () => {
  it('V3D-01 · every quarter hour of the day, in order, and nothing else', () => {
    const times = reminderTimes();

    expect(times).toHaveLength(96);
    expect(times[0]).toBe('00:00');
    expect(times.at(-1)).toBe('23:45');
    expect([...times].sort()).toEqual(times);
    expect(new Set(times).size).toBe(96);
    expect(times.every(isReminderTime)).toBe(true);
    expect(times).toContain(DEFAULT_REMINDER_TIME);
  });

  it('V3D-02 · rejects times that are not quarter hours', () => {
    for (const bad of ['20:01', '24:00', '8:00', '20:60', '', 'evening', null, 20]) {
      expect(isReminderTime(bad), String(bad)).toBe(false);
    }
  });

  it('V3D-03 · reads what Postgres gives back, and falls back rather than breaking', () => {
    // A `time` column comes back with seconds.
    expect(toReminderTime('20:00:00')).toBe('20:00');
    expect(toReminderTime('07:15:00')).toBe('07:15');
    // Anything unusable — an older or newer build, a hand-edited row — shows the default.
    for (const bad of ['20:07:00', 'nonsense', null, undefined, 42]) {
      expect(toReminderTime(bad), String(bad)).toBe(DEFAULT_REMINDER_TIME);
    }
  });

  it('V3D-04 · shows a time the way people say it', () => {
    expect(formatReminderTime('20:00')).toBe('8:00 pm');
    expect(formatReminderTime('00:00')).toBe('12:00 am');
    expect(formatReminderTime('00:15')).toBe('12:15 am');
    expect(formatReminderTime('12:00')).toBe('12:00 pm');
    expect(formatReminderTime('12:45')).toBe('12:45 pm');
    expect(formatReminderTime('09:30')).toBe('9:30 am');
    expect(formatReminderTime('23:45')).toBe('11:45 pm');
  });

  it('V3D-05 · reports the device timezone, the sender’s half of "your 8 pm"', () => {
    // The suite is pinned to UTC+8 (vitest.config.ts).
    expect(deviceTimezone()).toBe('Asia/Manila');
  });
});
