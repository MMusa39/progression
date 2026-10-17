import type { NutritionTrends } from '@/features/api/types';
import { isOnTarget, targetZone, trendBars, weeklyRows, weekStart } from '@/features/nutrition/trends';

const RULES = { calorieTolerance: 0.1, proteinMinimum: 0.9, macroTolerance: 0.15 };
const GOALS = { calories: 2000, proteinG: 150, carbsG: 200, fatG: 60, fiberG: 28 };
const n = (kcal: number, proteinG = 0) => ({ kcal, proteinG, carbsG: 0, fatG: 0, fiberG: 0 });

function trends(days: NutritionTrends['days']): NutritionTrends {
  return {
    from: days[0].date,
    to: days[days.length - 1].date,
    days,
    goals: GOALS,
    rules: RULES,
    summary: { finishedDays: 0, loggedDays: 0, loggingStreak: 0, average: null, onTarget: null },
  };
}

describe('target rules', () => {
  it('uses a ±10% band for calories and a minimum for protein', () => {
    expect(targetZone('calories', GOALS, RULES)).toEqual({ low: 1800, high: 2200, target: 2000 });
    expect(isOnTarget('calories', 2250, GOALS, RULES)).toBe(false);
    expect(isOnTarget('protein', 140, GOALS, RULES)).toBe(true); // 93%
    expect(isOnTarget('protein', 300, GOALS, RULES)).toBe(true); // more is fine
    expect(isOnTarget('carbs', 235, GOALS, RULES)).toBe(false); // +17.5%
  });
});

describe('weekStart', () => {
  it('returns the Monday', () => {
    expect(weekStart('2026-10-17')).toBe('2026-10-12'); // Saturday
    expect(weekStart('2026-10-12')).toBe('2026-10-12');
    expect(weekStart('2026-10-18')).toBe('2026-10-12'); // Sunday
  });
});

describe('trendBars', () => {
  it('charts short ranges daily, with gaps and today in progress', () => {
    const bars = trendBars(
      trends([
        { date: '2026-10-15', intake: n(2000) },
        { date: '2026-10-16', intake: null },
        { date: '2026-10-17', intake: n(500) },
      ]),
      'calories',
      '2026-10-17',
    );
    expect(bars.map((b) => b.value)).toEqual([2000, null, 500]);
    expect(bars.map((b) => b.inProgress)).toEqual([false, false, true]);
  });

  it('averages long ranges by week over logged, finished days', () => {
    const days: NutritionTrends['days'] = [];
    for (let i = 0; i < 50; i++) {
      const date = new Date(2026, 7, 29 + i); // Aug 29 (Sat) → Oct 17
      const iso = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
      days.push({ date: iso, intake: i % 2 === 0 ? n(2000 + i) : null });
    }
    const bars = trendBars(trends(days), 'calories', '2026-10-17');
    expect(bars[0].start).toBe('2026-08-24');
    expect(bars.every((b) => !b.inProgress)).toBe(true);
    expect(bars.length).toBe(8);
    const last = bars[bars.length - 1]; // Oct 12–17: logged on the 12th, 14th and 16th
    expect(last.loggedDays).toBe(3);
    expect(last.value).toBe((2044 + 2046 + 2048) / 3);
  });
});

describe('weeklyRows', () => {
  it('lists weeks newest first with averages and calories on target', () => {
    const rows = weeklyRows(
      trends([
        { date: '2026-10-05', intake: n(2100, 150) },
        { date: '2026-10-06', intake: n(2500, 100) },
        { date: '2026-10-13', intake: n(1900, 160) },
        { date: '2026-10-17', intake: n(400, 20) },
      ]),
      '2026-10-17',
    );
    expect(rows.map((r) => r.start)).toEqual(['2026-10-12', '2026-10-05']);
    expect(rows[0]).toMatchObject({ loggedDays: 1, kcal: 1900, caloriesOnTarget: 1 });
    expect(rows[1]).toMatchObject({ loggedDays: 2, kcal: 2300, proteinG: 125, caloriesOnTarget: 1 });
  });
});
