import { describe, it, expect } from 'vitest';
import {
  monthGrid, isValidDay, isoToDmy, dmyToIso, shiftMonth, sameDayInMonth, UZ_MONTHS_LAT, WEEKDAYS_LAT,
} from './calendar';

describe('monthGrid', () => {
  it('pads to whole weeks', () => {
    for (const m of ['2026-01', '2026-02', '2026-07', '2024-02', '2027-12']) {
      expect(monthGrid(m).length % 7).toBe(0);
    }
  });

  it('starts on Monday — 2026-06-01 is a Monday, so no leading blank', () => {
    expect(monthGrid('2026-06')[0]).toBe(1);
  });

  it('offsets a month that starts on Sunday — 2026-02-01, 6 leading blanks', () => {
    const cells = monthGrid('2026-02');
    expect(cells.slice(0, 6)).toEqual([null, null, null, null, null, null]);
    expect(cells[6]).toBe(1);
  });

  it('keeps every day of the month exactly once', () => {
    const days = monthGrid('2026-07').filter((d): d is number => d !== null);
    expect(days).toHaveLength(31);
    expect(new Set(days).size).toBe(31);
  });

  it('handles a leap February', () => {
    expect(monthGrid('2024-02').filter(Boolean)).toHaveLength(29);
    expect(monthGrid('2026-02').filter(Boolean)).toHaveLength(28);
  });
});

describe('isValidDay', () => {
  it('accepts real dates', () => {
    expect(isValidDay('2026-07-16')).toBe(true);
    expect(isValidDay('2024-02-29')).toBe(true);
  });

  it('rejects unreal and malformed dates', () => {
    // Date() would silently roll these over — the guard must not.
    expect(isValidDay('2026-02-30')).toBe(false);
    expect(isValidDay('2026-13-01')).toBe(false);
    expect(isValidDay('2026-2-3')).toBe(false);
    expect(isValidDay('16.07.2026')).toBe(false);
    expect(isValidDay(undefined)).toBe(false);
    expect(isValidDay('')).toBe(false);
  });
});

describe('isoToDmy / dmyToIso', () => {
  it('round-trips', () => {
    expect(isoToDmy('2026-07-16')).toBe('16.07.2026');
    expect(dmyToIso('16.07.2026')).toBe('2026-07-16');
    expect(dmyToIso(isoToDmy('2024-02-29'))).toBe('2024-02-29');
  });

  it('returns empty rather than a wrong date', () => {
    expect(isoToDmy('nonsense')).toBe('');
    expect(dmyToIso('16.07.20')).toBe('');
    expect(dmyToIso('30.02.2026')).toBe('');
    expect(dmyToIso('')).toBe('');
  });
});

describe('shiftMonth', () => {
  it('crosses year boundaries both ways', () => {
    expect(shiftMonth('2026-01', -1)).toBe('2025-12');
    expect(shiftMonth('2026-12', 1)).toBe('2027-01');
    expect(shiftMonth('2026-07', 0)).toBe('2026-07');
  });
});

describe('sameDayInMonth', () => {
  it('keeps the day when the target month is long enough', () => {
    expect(sameDayInMonth('2026-06', 16)).toBe('2026-06-16');
  });

  it('clamps instead of rolling into the next month', () => {
    // The bug this guards: new Date(2026, 1, 31) silently becomes 3 March.
    expect(sameDayInMonth('2026-02', 31)).toBe('2026-02-28');
    expect(sameDayInMonth('2024-02', 31)).toBe('2024-02-29');
    expect(sameDayInMonth('2026-04', 31)).toBe('2026-04-30');
  });

  it('always yields a day that exists', () => {
    for (const m of ['2026-01', '2026-02', '2026-04', '2024-02']) {
      for (const d of [1, 15, 28, 29, 30, 31]) {
        expect(isValidDay(sameDayInMonth(m, d))).toBe(true);
      }
    }
  });

  it('floors at the 1st', () => {
    expect(sameDayInMonth('2026-07', 0)).toBe('2026-07-01');
  });
});

describe('labels', () => {
  it('has 12 months and 7 Monday-first weekdays', () => {
    expect(UZ_MONTHS_LAT).toHaveLength(12);
    expect(UZ_MONTHS_LAT[6]).toBe('Iyul');
    expect(WEEKDAYS_LAT).toHaveLength(7);
    expect(WEEKDAYS_LAT[0]).toBe('Du');
  });
});
