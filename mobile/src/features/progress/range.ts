/**
 * The time range that scopes every chart on the Progress screens:
 * presets (last 4 weeks, 3 months, 6 months, 1 year, all time) plus a custom
 * "last N weeks/months". One shared, persisted selection, so the overview and
 * the exercise screens always show the same window.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

export type RangePreset = '4W' | '3M' | '6M' | '1Y' | 'ALL' | 'CUSTOM';
export type RangeUnit = 'weeks' | 'months';

export type ProgressRange = {
  preset: RangePreset;
  /** Used when preset is CUSTOM. */
  customCount: number;
  customUnit: RangeUnit;
};

export const PRESETS: { value: Exclude<RangePreset, 'CUSTOM'>; label: string }[] = [
  { value: '4W', label: '4W' },
  { value: '3M', label: '3M' },
  { value: '6M', label: '6M' },
  { value: '1Y', label: '1Y' },
  { value: 'ALL', label: 'All' },
];

export const CUSTOM_LIMITS: Record<RangeUnit, number> = { weeks: 104, months: 60 };

/** Length of a range as a count of weeks or months; null for all time. */
export function rangeLength(range: ProgressRange): { count: number; unit: RangeUnit } | null {
  switch (range.preset) {
    case '4W':
      return { count: 4, unit: 'weeks' };
    case '3M':
      return { count: 3, unit: 'months' };
    case '6M':
      return { count: 6, unit: 'months' };
    case '1Y':
      return { count: 12, unit: 'months' };
    case 'CUSTOM':
      return { count: range.customCount, unit: range.customUnit };
    case 'ALL':
      return null;
  }
}

/**
 * First instant of the range: N weeks/months before today, at local midnight.
 * Rounding to the day keeps the value (and so the query cache key) stable all day.
 */
export function rangeStart(range: ProgressRange, now = new Date()): Date | null {
  const length = rangeLength(range);
  if (!length) return null;
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  if (length.unit === 'weeks') start.setDate(start.getDate() - length.count * 7);
  else start.setMonth(start.getMonth() - length.count);
  return start;
}

/** "Last 4 weeks", "Last 1 month", "All time". */
export function rangeLabel(range: ProgressRange): string {
  const length = rangeLength(range);
  if (!length) return 'All time';
  const unit = length.count === 1 ? length.unit.slice(0, -1) : length.unit;
  return `Last ${length.count} ${unit}`;
}

/** Comparison label for deltas: "vs previous 4 weeks". */
export function previousPeriodLabel(range: ProgressRange): string | null {
  const length = rangeLength(range);
  if (!length) return null;
  const unit = length.count === 1 ? length.unit.slice(0, -1) : length.unit;
  return `vs previous ${length.count} ${unit}`;
}

type RangeState = ProgressRange & {
  setPreset: (preset: Exclude<RangePreset, 'CUSTOM'>) => void;
  setCustom: (count: number, unit: RangeUnit) => void;
};

export const useProgressRange = create<RangeState>()(
  persist(
    (set) => ({
      preset: '3M',
      customCount: 8,
      customUnit: 'weeks',
      setPreset: (preset) => set({ preset }),
      setCustom: (count, unit) =>
        set({ preset: 'CUSTOM', customCount: Math.max(1, Math.min(CUSTOM_LIMITS[unit], Math.round(count))), customUnit: unit }),
    }),
    { name: 'progression.progress-range', storage: createJSONStorage(() => AsyncStorage) },
  ),
);

/** The user's IANA time zone (e.g. "America/New_York"), so weekly buckets follow their calendar. */
export function deviceTimeZone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
  } catch {
    return 'UTC';
  }
}
