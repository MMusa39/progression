/**
 * Shaping nutrition trends for charts: which metric, whether a value is on
 * target (same rules as the server), and daily vs. weekly buckets.
 */
import type { Nutrients, NutritionTrends } from '@/features/api/types';
import { addDays } from '@/lib/dates';

export type MetricKey = 'calories' | 'protein' | 'carbs' | 'fat';

type Goals = NonNullable<NutritionTrends['goals']>;
type Rules = NutritionTrends['rules'];

export const METRICS: Record<
  MetricKey,
  { label: string; unit: string; value: (n: Nutrients) => number; goal: (g: Goals) => number; kind: 'band' | 'minimum' }
> = {
  calories: { label: 'Calories', unit: 'kcal', value: (n) => n.kcal, goal: (g) => g.calories, kind: 'band' },
  protein: { label: 'Protein', unit: 'g', value: (n) => n.proteinG, goal: (g) => g.proteinG, kind: 'minimum' },
  carbs: { label: 'Carbs', unit: 'g', value: (n) => n.carbsG, goal: (g) => g.carbsG, kind: 'band' },
  fat: { label: 'Fat', unit: 'g', value: (n) => n.fatG, goal: (g) => g.fatG, kind: 'band' },
};

/** The on-target zone for a metric: [low, high], where high is Infinity for a minimum. */
export function targetZone(metric: MetricKey, goals: Goals, rules: Rules): { low: number; high: number; target: number } {
  const target = METRICS[metric].goal(goals);
  if (METRICS[metric].kind === 'minimum') return { low: target * rules.proteinMinimum, high: Infinity, target };
  const tolerance = metric === 'calories' ? rules.calorieTolerance : rules.macroTolerance;
  return { low: target * (1 - tolerance), high: target * (1 + tolerance), target };
}

export function isOnTarget(metric: MetricKey, value: number, goals: Goals, rules: Rules): boolean {
  const zone = targetZone(metric, goals, rules);
  return zone.target > 0 && value >= zone.low && value <= zone.high;
}

/** Ranges up to this many days chart one bar per day; longer ones chart weekly averages. */
export const DAILY_LIMIT_DAYS = 42;

export type TrendBar = {
  key: string;
  /** First and last calendar day the bar covers (the same day for daily bars). */
  start: string;
  end: string;
  /** Mean over logged days, or null when nothing was logged. */
  value: number | null;
  loggedDays: number;
  /** Today's bar: still in progress, so it's drawn differently and not judged. */
  inProgress: boolean;
};

/** Monday of the week containing `date`. */
export function weekStart(date: string): string {
  const [y, m, d] = date.split('-').map(Number);
  const weekday = (new Date(y, m - 1, d).getDay() + 6) % 7; // Monday = 0
  return addDays(date, -weekday);
}

export function trendBars(trends: NutritionTrends, metric: MetricKey, today: string): TrendBar[] {
  const value = METRICS[metric].value;
  if (trends.days.length <= DAILY_LIMIT_DAYS) {
    return trends.days.map((d) => ({
      key: d.date,
      start: d.date,
      end: d.date,
      value: d.intake ? value(d.intake) : null,
      loggedDays: d.intake ? 1 : 0,
      inProgress: d.date === today,
    }));
  }
  // Weekly averages over finished, logged days (today is left out until it's over).
  const weeks = new Map<string, { end: string; values: number[] }>();
  for (const d of trends.days) {
    const start = weekStart(d.date);
    const week = weeks.get(start) ?? { end: d.date, values: [] };
    week.end = d.date;
    if (d.intake && d.date !== today) week.values.push(value(d.intake));
    weeks.set(start, week);
  }
  return [...weeks.entries()].map(([start, w]) => ({
    key: start,
    start,
    end: w.end,
    value: w.values.length ? w.values.reduce((a, b) => a + b, 0) / w.values.length : null,
    loggedDays: w.values.length,
    inProgress: false,
  }));
}

export type WeekRow = { start: string; loggedDays: number; kcal: number | null; proteinG: number | null; caloriesOnTarget: number };

/** Weekly averages for the table under the chart, newest first. */
export function weeklyRows(trends: NutritionTrends, today: string, limit = 12): WeekRow[] {
  const weeks = new Map<string, Nutrients[]>();
  for (const d of trends.days) {
    const start = weekStart(d.date);
    if (!weeks.has(start)) weeks.set(start, []);
    if (d.intake && d.date !== today) weeks.get(start)!.push(d.intake);
  }
  return [...weeks.entries()]
    .reverse()
    .slice(0, limit)
    .map(([start, days]) => ({
      start,
      loggedDays: days.length,
      kcal: days.length ? days.reduce((a, n) => a + n.kcal, 0) / days.length : null,
      proteinG: days.length ? days.reduce((a, n) => a + n.proteinG, 0) / days.length : null,
      caloriesOnTarget: trends.goals ? days.filter((n) => isOnTarget('calories', n.kcal, trends.goals!, trends.rules)).length : 0,
    }));
}

/** Server adherence count for a metric. */
export function onTargetCount(trends: NutritionTrends, metric: MetricKey): number | null {
  const counts = trends.summary.onTarget;
  if (!counts) return null;
  return counts[metric];
}
