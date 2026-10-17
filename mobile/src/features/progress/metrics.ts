/**
 * The metrics an exercise chart can show, and how to read each from a
 * progression point in the user's unit.
 */
import type { Equipment, ExerciseProgression, ProgressionPoint, WeightUnit } from '@/features/api/types';
import { formatWeight, kgTo, unitLabel } from '@/features/workout/format';

export type MetricKey = 'e1rm' | 'topSet' | 'volume' | 'reps';

type Metric = {
  key: MetricKey;
  /** Short label for the metric switch. */
  label: string;
  /** Full name used in titles and accessibility labels. */
  title: string;
  description: string;
  value: (point: ProgressionPoint, unit: WeightUnit) => number;
  format: (value: number, unit: WeightUnit) => string;
};

const weight = (value: number, unit: WeightUnit) => `${formatWeight(Math.round(value * 10) / 10)} ${unitLabel(unit)}`;

export const metrics: Record<MetricKey, Metric> = {
  e1rm: {
    key: 'e1rm',
    label: 'Est. 1RM',
    title: 'Estimated one-rep max',
    description: 'The most you could likely lift once, estimated from your best set each session.',
    value: (p, unit) => kgTo(unit, p.bestE1rmKg),
    format: (v, unit) => `${Math.round(v)} ${unitLabel(unit)}`,
  },
  topSet: {
    key: 'topSet',
    label: 'Top set',
    title: 'Heaviest set',
    description: 'The heaviest weight you lifted each session.',
    value: (p, unit) => kgTo(unit, p.topSetWeightKg),
    format: weight,
  },
  volume: {
    key: 'volume',
    label: 'Volume',
    title: 'Session volume',
    description: 'Total weight moved per session (weight × reps, warm-ups excluded).',
    value: (p, unit) => kgTo(unit, p.volumeKg),
    format: (v, unit) => `${Math.round(v).toLocaleString()} ${unitLabel(unit)}`,
  },
  reps: {
    key: 'reps',
    label: 'Reps',
    title: 'Best set reps',
    description: 'The most reps you did in a single set each session.',
    value: (p) => p.bestReps,
    format: (v) => `${Math.round(v)} reps`,
  },
};

/** Bodyweight movements progress in reps; everything else defaults to estimated 1RM. */
export function defaultMetric(equipment: Equipment, progression?: ExerciseProgression): MetricKey {
  if (equipment === 'BODYWEIGHT') return 'reps';
  if (progression && progression.points.length > 0 && progression.points.every((p) => p.topSetWeightKg === 0)) {
    return 'reps';
  }
  return 'e1rm';
}

/** Change from the first to the last value, as an absolute amount and a percentage. */
export function change(values: number[]): { absolute: number; percent: number | null } | null {
  if (values.length < 2) return null;
  const first = values[0];
  const last = values[values.length - 1];
  return { absolute: last - first, percent: first === 0 ? null : ((last - first) / first) * 100 };
}
