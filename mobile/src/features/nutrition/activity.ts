import type { ActivityLevel, Sex } from '@/features/api/types';

export const ACTIVITY: { value: ActivityLevel; label: string; detail: string }[] = [
  { value: 'SEDENTARY', label: 'Mostly sitting', detail: 'Desk job, little exercise' },
  { value: 'LIGHT', label: 'Lightly active', detail: 'Exercise 1–3 days a week' },
  { value: 'MODERATE', label: 'Moderately active', detail: 'Exercise 3–5 days a week' },
  { value: 'ACTIVE', label: 'Very active', detail: 'Hard exercise 6–7 days a week' },
  { value: 'VERY_ACTIVE', label: 'Extremely active', detail: 'Physical job plus training' },
];

export const activityLabel = (level: ActivityLevel) => ACTIVITY.find((a) => a.value === level)?.label ?? level;

export const sexLabel: Record<Sex, string> = { MALE: 'Male', FEMALE: 'Female', UNSPECIFIED: 'Prefer not to say' };

export const CM_PER_IN = 2.54;

/** 178 cm → "5 ft 10 in" (imperial) or "178 cm". */
export function heightLabel(cm: number, imperial: boolean): string {
  if (!imperial) return `${Math.round(cm)} cm`;
  const totalIn = Math.round(cm / CM_PER_IN);
  return `${Math.floor(totalIn / 12)} ft ${totalIn % 12} in`;
}
