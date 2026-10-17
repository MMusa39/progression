/** Display formatting for weights, volume, durations and dates. */
import type { WeightUnit } from '@/features/api/types';

const KG_PER_LB = 0.45359237;

export const unitLabel = (unit: WeightUnit) => (unit === 'LB' ? 'lb' : 'kg');

/** "185", "102.5", never "185.00". */
export function formatWeight(weight: number): string {
  return Number.isInteger(weight) ? String(weight) : String(Number(weight.toFixed(2)));
}

export function kgTo(unit: WeightUnit, kg: number): number {
  return unit === 'KG' ? kg : kg / KG_PER_LB;
}

/** Total volume in the user's unit, e.g. "12,340 lb". */
export function formatVolume(kg: number, unit: WeightUnit): string {
  return `${Math.round(kgTo(unit, kg)).toLocaleString()} ${unitLabel(unit)}`;
}

/** Compact volume for tiles: "24.4K lb". */
export function formatVolumeCompact(kg: number, unit: WeightUnit): string {
  const value = kgTo(unit, kg);
  const compact = value >= 1000 ? `${Number((value / 1000).toFixed(value >= 100_000 ? 0 : 1))}K` : String(Math.round(value));
  return `${compact} ${unitLabel(unit)}`;
}

/** "185 × 8", or "8 reps" for bodyweight sets. */
export function formatSet(weight: number, reps: number, unit?: WeightUnit): string {
  if (weight === 0) return `${reps} reps`;
  return `${formatWeight(weight)}${unit ? ` ${unitLabel(unit)}` : ''} × ${reps}`;
}

/** Live timer format: "4:05", "1:02:09". */
export function formatElapsed(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const mm = h > 0 ? String(m).padStart(2, '0') : String(m);
  return `${h > 0 ? `${h}:` : ''}${mm}:${String(s).padStart(2, '0')}`;
}

/** Summary duration: "48m", "1h 12m". */
export function formatDuration(startIso: string, endIso: string | null): string | null {
  if (!endIso) return null;
  const minutes = Math.round((new Date(endIso).getTime() - new Date(startIso).getTime()) / 60_000);
  if (minutes < 60) return `${minutes}m`;
  return `${Math.floor(minutes / 60)}h ${minutes % 60}m`;
}

/** "Today", "Yesterday", "Mon, Oct 12", or "Oct 12, 2025" for other years. */
export function formatWorkoutDate(iso: string): string {
  const date = new Date(iso);
  const today = new Date();
  const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  const days = Math.round((startOfDay(today) - startOfDay(date)) / 86_400_000);
  if (days === 0) return 'Today';
  if (days === 1) return 'Yesterday';
  return date.toLocaleDateString(undefined, {
    weekday: date.getFullYear() === today.getFullYear() ? 'short' : undefined,
    month: 'short',
    day: 'numeric',
    year: date.getFullYear() === today.getFullYear() ? undefined : 'numeric',
  });
}

/** Default workout name from the time of day: "Morning Workout", "Evening Workout"... */
export function defaultWorkoutName(date = new Date()): string {
  const hour = date.getHours();
  if (hour < 5) return 'Night Workout';
  if (hour < 12) return 'Morning Workout';
  if (hour < 17) return 'Afternoon Workout';
  if (hour < 21) return 'Evening Workout';
  return 'Night Workout';
}

export const muscleGroupLabel: Record<string, string> = {
  CHEST: 'Chest', BACK: 'Back', SHOULDERS: 'Shoulders', BICEPS: 'Biceps', TRICEPS: 'Triceps',
  FOREARMS: 'Forearms', QUADS: 'Quads', HAMSTRINGS: 'Hamstrings', GLUTES: 'Glutes', CALVES: 'Calves',
  CORE: 'Core', FULL_BODY: 'Full Body',
};

export const equipmentLabel: Record<string, string> = {
  BARBELL: 'Barbell', DUMBBELL: 'Dumbbell', MACHINE: 'Machine', CABLE: 'Cable', BODYWEIGHT: 'Bodyweight',
  KETTLEBELL: 'Kettlebell', SMITH_MACHINE: 'Smith Machine', BAND: 'Band', OTHER: 'Other',
};
