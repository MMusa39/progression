import { formatDuration, formatElapsed, formatSet, formatVolume, formatWeight } from '@/features/workout/format';

describe('format', () => {
  it('drops trailing zeros from weights', () => {
    expect(formatWeight(185)).toBe('185');
    expect(formatWeight(102.5)).toBe('102.5');
    expect(formatWeight(22.75)).toBe('22.75');
  });

  it('formats sets, treating zero weight as bodyweight', () => {
    expect(formatSet(185, 8)).toBe('185 × 8');
    expect(formatSet(100, 5, 'KG')).toBe('100 kg × 5');
    expect(formatSet(0, 12)).toBe('12 reps');
  });

  it('converts volume into the preferred unit', () => {
    expect(formatVolume(1000, 'KG')).toBe('1,000 kg');
    expect(formatVolume(453.59237, 'LB')).toBe('1,000 lb');
  });

  it('formats a live timer', () => {
    expect(formatElapsed(65_000)).toBe('1:05');
    expect(formatElapsed(3_725_000)).toBe('1:02:05');
  });

  it('formats a finished workout duration', () => {
    expect(formatDuration('2026-10-16T18:00:00Z', '2026-10-16T18:48:00Z')).toBe('48m');
    expect(formatDuration('2026-10-16T18:00:00Z', '2026-10-16T19:12:00Z')).toBe('1h 12m');
    expect(formatDuration('2026-10-16T18:00:00Z', null)).toBeNull();
  });
});
