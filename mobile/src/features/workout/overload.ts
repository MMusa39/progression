/**
 * Progressive-overload hints: what to aim for today, from last session.
 *
 * "Double progression", the standard approach for intermediate lifters:
 * work within a rep range at one weight; once every working set reaches the
 * top of the range, add weight and start again at the bottom. Without a
 * routine's rep range, the target is matching last session's first-set reps
 * on every set (no drop-off), which signals the weight has become easy.
 *
 * Pure functions, unit-tested; ExerciseCard turns the result into the
 * greyed-out set suggestions, so ticking a set logs the progressed numbers.
 */
import type { Equipment, WeightUnit, WorkoutSet } from '@/features/api/types';

import { formatWeight, unitLabel } from './format';

export type RepRange = { repMin: number; repMax: number };

export type OverloadHint = {
  kind: 'add-weight' | 'add-reps';
  weight: number;
  reps: number;
  unit: WeightUnit;
  /** Short reason, e.g. "You hit 8 reps on all 3 sets last time". */
  reason: string;
};

/** The smallest sensible jump for the equipment, in the set's unit. */
export function weightIncrement(equipment: Equipment, unit: WeightUnit): number {
  if (unit === 'KG') return equipment === 'DUMBBELL' || equipment === 'KETTLEBELL' ? 2 : 2.5;
  return 5;
}

export function overloadHint(lastSets: WorkoutSet[], equipment: Equipment, target?: RepRange): OverloadHint | null {
  const working = lastSets.filter((s) => s.setType === 'WORKING' || s.setType === 'FAILURE');
  if (working.length === 0) return null;

  const topWeight = Math.max(...working.map((s) => s.weight));
  const topSets = working.filter((s) => s.weight === topWeight);
  const unit = topSets[0].weightUnit;
  const minReps = Math.min(...topSets.map((s) => s.reps));
  const sets = `${topSets.length === 1 ? 'your set' : `all ${topSets.length} sets`}`;

  // Bodyweight (or unloaded) movements progress by reps.
  if (equipment === 'BODYWEIGHT' || topWeight === 0) {
    const reps = target ? Math.min(minReps + 1, target.repMax) : minReps + 1;
    return { kind: 'add-reps', weight: topWeight, reps, unit, reason: `One more rep than last time's ${minReps}` };
  }

  const goal = target ? target.repMax : topSets[0].reps;
  if (minReps >= goal) {
    const weight = topWeight + weightIncrement(equipment, unit);
    return {
      kind: 'add-weight',
      weight,
      reps: target ? target.repMin : goal,
      unit,
      reason: `You hit ${goal} reps on ${sets} last time`,
    };
  }

  const reps = Math.min(minReps + 1, goal);
  return {
    kind: 'add-reps',
    weight: topWeight,
    reps,
    unit,
    reason: target ? `Building toward ${target.repMax} reps at this weight` : `Match ${goal} reps on every set, then add weight`,
  };
}

/** "190 lb × 8". */
export function formatHint(hint: OverloadHint): string {
  return hint.weight > 0 ? `${formatWeight(hint.weight)} ${unitLabel(hint.unit)} × ${hint.reps}` : `${hint.reps} reps`;
}
