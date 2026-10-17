import { formatCompact, linearScale, nearestIndex, niceTicks } from '@/components/charts/scale';

describe('linearScale', () => {
  it('maps domain onto range, including inverted ranges (SVG y grows downward)', () => {
    const y = linearScale([0, 100], [200, 0]);
    expect(y(0)).toBe(200);
    expect(y(50)).toBe(100);
    expect(y(100)).toBe(0);
  });

  it('maps a zero-width domain to the middle of the range', () => {
    expect(linearScale([5, 5], [0, 100])(5)).toBe(50);
  });
});

describe('niceTicks', () => {
  it('produces round, evenly spaced ticks that cover the data', () => {
    expect(niceTicks(103, 187, 4)).toEqual([100, 125, 150, 175, 200]);
  });

  it('starts at zero when asked (bars)', () => {
    expect(niceTicks(1200, 9800, 3, true)).toEqual([0, 5000, 10000]);
  });

  it('pads a flat series so it still has a visible range', () => {
    const ticks = niceTicks(100, 100, 4);
    expect(ticks[0]).toBeLessThan(100);
    expect(ticks.at(-1)).toBeGreaterThan(100);
  });
});

describe('formatCompact', () => {
  it.each([
    [0, '0'],
    [950, '950'],
    [1200, '1.2K'],
    [15000, '15K'],
    [2_500_000, '2.5M'],
  ])('%d → %s', (value, expected) => expect(formatCompact(value)).toBe(expected));
});

describe('nearestIndex', () => {
  it('snaps to the closest position', () => {
    expect(nearestIndex([10, 50, 90], 62)).toBe(1);
    expect(nearestIndex([10, 50, 90], 200)).toBe(2);
    expect(nearestIndex([], 5)).toBe(-1);
  });
});
