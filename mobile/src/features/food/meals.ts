import type { Meal } from '@/features/api/types';

export const MEALS: Meal[] = ['BREAKFAST', 'LUNCH', 'DINNER', 'SNACK'];

export const mealLabel: Record<Meal, string> = {
  BREAKFAST: 'Breakfast',
  LUNCH: 'Lunch',
  DINNER: 'Dinner',
  SNACK: 'Snacks',
};

/** A sensible default meal for "add food" based on the time of day. */
export function mealForNow(date = new Date()): Meal {
  const h = date.getHours();
  if (h < 10) return 'BREAKFAST';
  if (h < 15) return 'LUNCH';
  if (h < 21) return 'DINNER';
  return 'SNACK';
}

/** "1 serving", "2.5 servings", "150 g". */
export function amountLabel(amount: number, unit: 'G' | 'SERVING', servingLabel?: string | null): string {
  const n = Number.isInteger(amount) ? String(amount) : String(Number(amount.toFixed(2)));
  if (unit === 'G') return `${n} g`;
  if (servingLabel && amount === 1) return servingLabel;
  return `${n} serving${amount === 1 ? '' : 's'}`;
}
