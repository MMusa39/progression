import { shortDate } from '@/features/progress/dates';
import { addDays, dayLabel, localDate } from '@/lib/dates';

describe('localDate', () => {
  it('formats the local calendar day with zero padding', () => {
    expect(localDate(new Date(2026, 0, 5, 23, 59))).toBe('2026-01-05');
  });
});

describe('addDays', () => {
  it('crosses month and year boundaries', () => {
    expect(addDays('2026-01-31', 1)).toBe('2026-02-01');
    expect(addDays('2026-01-01', -1)).toBe('2025-12-31');
  });

  it('handles leap days', () => {
    expect(addDays('2028-02-28', 1)).toBe('2028-02-29');
    expect(addDays('2027-02-28', 1)).toBe('2027-03-01');
  });
});

describe('dayLabel', () => {
  const today = '2026-10-17';
  it('names nearby days', () => {
    expect(dayLabel(today, today)).toBe('Today');
    expect(dayLabel('2026-10-16', today)).toBe('Yesterday');
    expect(dayLabel('2026-10-18', today)).toBe('Tomorrow');
  });

  it('falls back to a short date', () => {
    expect(dayLabel('2026-10-10', today)).toMatch(/Oct/);
  });
});

describe('shortDate', () => {
  it('reads a bare calendar date as a local day, not UTC midnight', () => {
    // In any timezone west of UTC, new Date('2027-01-09') is still Jan 8 locally.
    expect(shortDate('2027-01-09')).toMatch(/Jan 9\b/);
  });
});
