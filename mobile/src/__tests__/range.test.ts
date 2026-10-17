import { previousPeriodLabel, rangeLabel, rangeStart, type ProgressRange } from '@/features/progress/range';

const base: ProgressRange = { preset: '3M', customCount: 8, customUnit: 'weeks' };
const NOW = new Date(2026, 9, 16, 15, 30); // Oct 16 2026, 3:30pm local

describe('progress range', () => {
  it('starts at local midnight N weeks or months ago', () => {
    expect(rangeStart({ ...base, preset: '4W' }, NOW)).toEqual(new Date(2026, 8, 18));
    expect(rangeStart({ ...base, preset: '3M' }, NOW)).toEqual(new Date(2026, 6, 16));
    expect(rangeStart({ ...base, preset: '1Y' }, NOW)).toEqual(new Date(2025, 9, 16));
  });

  it('supports custom "last N weeks/months"', () => {
    expect(rangeStart({ ...base, preset: 'CUSTOM', customCount: 10, customUnit: 'weeks' }, NOW)).toEqual(new Date(2026, 7, 7));
    expect(rangeStart({ ...base, preset: 'CUSTOM', customCount: 18, customUnit: 'months' }, NOW)).toEqual(new Date(2025, 3, 16));
  });

  it('has no start for all time', () => {
    expect(rangeStart({ ...base, preset: 'ALL' }, NOW)).toBeNull();
  });

  it('describes ranges in words', () => {
    expect(rangeLabel({ ...base, preset: '4W' })).toBe('Last 4 weeks');
    expect(rangeLabel({ ...base, preset: 'CUSTOM', customCount: 1, customUnit: 'months' })).toBe('Last 1 month');
    expect(rangeLabel({ ...base, preset: 'ALL' })).toBe('All time');
    expect(previousPeriodLabel({ ...base, preset: '6M' })).toBe('vs previous 6 months');
    expect(previousPeriodLabel({ ...base, preset: 'ALL' })).toBeNull();
  });
});
