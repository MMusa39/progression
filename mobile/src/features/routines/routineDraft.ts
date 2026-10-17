/**
 * The routine being edited. "Add exercises" reuses the exercise picker, which
 * drops picks into this draft (instead of the active workout) and returns.
 */
import { randomUUID } from 'expo-crypto';
import { create } from 'zustand';

import type { Exercise, Routine, Workout } from '@/features/api/types';

export type DraftRoutineExercise = {
  key: string;
  exercise: Pick<Exercise, 'id' | 'name' | 'muscleGroup' | 'equipment'>;
  sets: number;
  repMin: number;
  repMax: number;
};

type RoutineDraftState = {
  id: string | null;
  name: string;
  exercises: DraftRoutineExercise[];
  load: (id: string, routine?: Routine) => void;
  /** A new routine copied from a past workout: its exercises, working-set counts and rep ranges. */
  loadFromWorkout: (workout: Workout, id: string) => void;
  setName: (name: string) => void;
  addExercises: (exercises: DraftRoutineExercise['exercise'][]) => void;
  update: (key: string, patch: Partial<Pick<DraftRoutineExercise, 'sets' | 'repMin' | 'repMax'>>) => void;
  move: (key: string, direction: -1 | 1) => void;
  remove: (key: string) => void;
};

export const DEFAULT_TARGET = { sets: 3, repMin: 8, repMax: 12 };

export const useRoutineDraft = create<RoutineDraftState>()((set) => ({
  id: null,
  name: '',
  exercises: [],
  load: (id, routine) =>
    set({
      id,
      name: routine?.name ?? '',
      exercises:
        routine?.exercises.map((e) => ({
          key: randomUUID(),
          exercise: { id: e.exerciseId, name: e.exerciseName, muscleGroup: e.muscleGroup, equipment: e.equipment },
          sets: e.sets,
          repMin: e.repMin,
          repMax: e.repMax,
        })) ?? [],
    }),
  loadFromWorkout: (workout, id) =>
    set({
      id,
      name: workout.name,
      exercises: workout.exercises.map((we) => {
        const working = we.sets.filter((s) => s.setType === 'WORKING');
        const reps = (working.length ? working : we.sets).map((s) => s.reps);
        return {
          key: randomUUID(),
          exercise: { id: we.exerciseId, name: we.exerciseName, muscleGroup: we.muscleGroup, equipment: we.equipment },
          sets: Math.max(1, Math.min(20, working.length || we.sets.length)),
          repMin: Math.max(1, Math.min(...reps)),
          repMax: Math.max(1, Math.max(...reps)),
        };
      }),
    }),
  setName: (name) => set({ name }),
  addExercises: (exercises) =>
    set((s) => ({
      exercises: [...s.exercises, ...exercises.map((exercise) => ({ key: randomUUID(), exercise, ...DEFAULT_TARGET }))],
    })),
  update: (key, patch) => set((s) => ({ exercises: s.exercises.map((e) => (e.key === key ? { ...e, ...patch } : e)) })),
  move: (key, direction) =>
    set((s) => {
      const i = s.exercises.findIndex((e) => e.key === key);
      const j = i + direction;
      if (i < 0 || j < 0 || j >= s.exercises.length) return s;
      const exercises = [...s.exercises];
      [exercises[i], exercises[j]] = [exercises[j], exercises[i]];
      return { exercises };
    }),
  remove: (key) => set((s) => ({ exercises: s.exercises.filter((e) => e.key !== key) })),
}));
