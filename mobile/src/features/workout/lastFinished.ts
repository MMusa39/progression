/**
 * Snapshot of the workout that was just finished, for the "Workout complete"
 * screen. It exists only in memory: the screen is shown once, right after Finish.
 */
import { create } from 'zustand';

import type { ActiveWorkout } from './activeWorkoutStore';

const KG_PER_LB = 0.45359237;

export type FinishedSummary = {
  id: string;
  name: string;
  startedAt: string;
  endedAt: string;
  exercises: { name: string; sets: number }[];
  sets: number;
  volumeKg: number;
};

export const useLastFinished = create<{ summary: FinishedSummary | null; set: (s: FinishedSummary) => void }>()((set) => ({
  summary: null,
  set: (summary) => set({ summary }),
}));

/** Summarizes the completed, non-warm-up sets of a workout about to be finished. */
export function summarize(active: ActiveWorkout): FinishedSummary {
  let sets = 0;
  let volumeKg = 0;
  const exercises = active.exercises
    .map((we) => {
      const done = we.sets.filter((s) => s.completedAt);
      done
        .filter((s) => s.setType !== 'WARMUP')
        .forEach((s) => {
          sets += 1;
          const weight = Number(s.weight.replace(',', '.'));
          volumeKg += (s.weightUnit === 'LB' ? weight * KG_PER_LB : weight) * Number(s.reps);
        });
      return { name: we.exercise.name, sets: done.length };
    })
    .filter((e) => e.sets > 0);
  return { id: active.id, name: active.name, startedAt: active.startedAt, endedAt: new Date().toISOString(), exercises, sets, volumeKg };
}
