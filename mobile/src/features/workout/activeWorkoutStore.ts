/**
 * The workout currently being logged, kept on the device.
 *
 * Every keystroke updates this store, and the store is persisted to
 * AsyncStorage, so the workout survives the app being killed, the phone
 * restarting, or having no signal. Nothing is sent to the server until the user
 * taps Finish, at which point the workout moves to the upload queue
 * (`workoutSync.ts`).
 *
 * IDs are generated here, on the phone (randomUUID), and kept when saved.
 * That's what makes the server-side save idempotent (see ADR 0003).
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import { randomUUID } from 'expo-crypto';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

import type { Exercise, Routine, SetType, WeightUnit, Workout, WorkoutRequest } from '@/features/api/types';

import { defaultWorkoutName } from './format';

/** A set while editing: weight/reps are the raw text-field strings. */
export type DraftSet = {
  id: string;
  setType: SetType;
  weight: string;
  reps: string;
  weightUnit: WeightUnit;
  completedAt: string | null;
};

export type DraftExercise = {
  id: string;
  exercise: Pick<Exercise, 'id' | 'name' | 'muscleGroup' | 'equipment'>;
  notes: string;
  sets: DraftSet[];
  /**
   * Whether the note has been filled in (from last session) or edited. Once true,
   * last session's note is never applied again, so clearing a note sticks.
   */
  notesSeeded?: boolean;
  /** From a routine: the plan for this exercise. Drives the target line and overload hints. */
  target?: { sets: number; repMin: number; repMax: number };
};

export type ActiveWorkout = {
  id: string;
  name: string;
  startedAt: string;
  exercises: DraftExercise[];
  /**
   * Set when an already-saved workout is being edited: its original end time is
   * kept, and saving updates it in place (same id, same idempotent PUT).
   */
  editing?: { endedAt: string | null };
};

type ActiveWorkoutState = {
  active: ActiveWorkout | null;

  /** Starts empty, repeating a past workout (`from`), or from a routine. */
  start: (options?: { name?: string; from?: Workout; routine?: Routine; unit?: WeightUnit }) => void;
  /** Opens a saved workout for editing, keeping its ids, sets and times. */
  edit: (workout: Workout) => void;
  discard: () => void;
  rename: (name: string) => void;
  addExercises: (exercises: DraftExercise['exercise'][], unit: WeightUnit) => void;
  removeExercise: (workoutExerciseId: string) => void;
  moveExercise: (workoutExerciseId: string, direction: -1 | 1) => void;
  setNotes: (workoutExerciseId: string, notes: string) => void;
  /** Carries last session's note into this exercise, once (sticky notes like "Seat at 4"). */
  seedNotes: (workoutExerciseId: string, notes: string | null) => void;
  addSet: (workoutExerciseId: string) => void;
  removeSet: (workoutExerciseId: string, setId: string) => void;
  updateSet: (workoutExerciseId: string, setId: string, patch: Partial<Pick<DraftSet, 'weight' | 'reps' | 'setType'>>) => void;
  /**
   * Ticks a set off, or un-ticks it. Blank fields are filled from `fallback`
   * (the greyed-out suggestion: last session's numbers or the set above).
   * Returns false if there's still no weight/reps to record.
   */
  toggleComplete: (workoutExerciseId: string, setId: string, fallback?: { weight: string; reps: string }) => boolean;
  /** Ends the workout: returns the payload to upload and clears the active workout. */
  finish: () => { id: string; request: WorkoutRequest } | null;
};

const newSet = (unit: WeightUnit, setType: SetType = 'WORKING'): DraftSet => ({
  id: randomUUID(),
  setType,
  weight: '',
  reps: '',
  weightUnit: unit,
  completedAt: null,
});

/** Applies `fn` to one exercise in the active workout, leaving the rest untouched (immutable update). */
function updateExercise(
  active: ActiveWorkout | null,
  workoutExerciseId: string,
  fn: (exercise: DraftExercise) => DraftExercise,
): ActiveWorkout | null {
  if (!active) return active;
  return {
    ...active,
    exercises: active.exercises.map((we) => (we.id === workoutExerciseId ? fn(we) : we)),
  };
}

const parseNumber = (text: string) => Number(text.replace(',', '.'));

export const useActiveWorkout = create<ActiveWorkoutState>()(
  persist(
    (set, get) => ({
      active: null,

      start: ({ name, from, routine, unit = 'LB' } = {}) =>
        set({
          active: {
            id: randomUUID(),
            name: name ?? routine?.name ?? from?.name ?? defaultWorkoutName(),
            startedAt: new Date().toISOString(),
            // Routine: its exercises with the planned number of sets and the rep range as a target.
            // "Repeat workout": same exercises and set count. Either way values start blank
            // (last time's numbers, or the overload hint, show as suggestions).
            exercises: routine
              ? routine.exercises.map((re) => ({
                  id: randomUUID(),
                  exercise: { id: re.exerciseId, name: re.exerciseName, muscleGroup: re.muscleGroup, equipment: re.equipment },
                  notes: '',
                  sets: Array.from({ length: re.sets }, () => newSet(unit)),
                  target: { sets: re.sets, repMin: re.repMin, repMax: re.repMax },
                }))
              : (from?.exercises.map((we) => ({
                  id: randomUUID(),
                  exercise: { id: we.exerciseId, name: we.exerciseName, muscleGroup: we.muscleGroup, equipment: we.equipment },
                  notes: we.notes ?? '',
                  notesSeeded: true,
                  sets: we.sets.map((s) => newSet(s.weightUnit ?? unit, s.setType)),
                })) ?? []),
          },
        }),

      edit: (workout) =>
        set({
          active: {
            id: workout.id,
            name: workout.name,
            startedAt: workout.startedAt,
            editing: { endedAt: workout.endedAt },
            exercises: workout.exercises.map((we) => ({
              id: we.id,
              exercise: { id: we.exerciseId, name: we.exerciseName, muscleGroup: we.muscleGroup, equipment: we.equipment },
              notes: we.notes ?? '',
              notesSeeded: true,
              sets: we.sets.map((s) => ({
                id: s.id,
                setType: s.setType,
                weight: String(s.weight),
                reps: String(s.reps),
                weightUnit: s.weightUnit,
                // Saved sets were done; keep them ticked so they're kept on save.
                completedAt: s.completedAt ?? workout.startedAt,
              })),
            })),
          },
        }),

      discard: () => set({ active: null }),

      rename: (name) => set(({ active }) => ({ active: active && { ...active, name } })),

      addExercises: (exercises, unit) =>
        set(({ active }) => ({
          active: active && {
            ...active,
            exercises: [
              ...active.exercises,
              ...exercises.map((exercise) => ({ id: randomUUID(), exercise, notes: '', sets: [newSet(unit)] })),
            ],
          },
        })),

      removeExercise: (workoutExerciseId) =>
        set(({ active }) => ({
          active: active && { ...active, exercises: active.exercises.filter((we) => we.id !== workoutExerciseId) },
        })),

      moveExercise: (workoutExerciseId, direction) =>
        set(({ active }) => {
          if (!active) return { active };
          const index = active.exercises.findIndex((we) => we.id === workoutExerciseId);
          const target = index + direction;
          if (index < 0 || target < 0 || target >= active.exercises.length) return { active };
          const exercises = [...active.exercises];
          [exercises[index], exercises[target]] = [exercises[target], exercises[index]];
          return { active: { ...active, exercises } };
        }),

      setNotes: (workoutExerciseId, notes) =>
        set(({ active }) => ({ active: updateExercise(active, workoutExerciseId, (we) => ({ ...we, notes, notesSeeded: true })) })),

      seedNotes: (workoutExerciseId, notes) =>
        set(({ active }) => ({
          active: updateExercise(active, workoutExerciseId, (we) =>
            we.notesSeeded ? we : { ...we, notes: we.notes || (notes ?? ''), notesSeeded: true },
          ),
        })),

      addSet: (workoutExerciseId) =>
        set(({ active }) => ({
          active: updateExercise(active, workoutExerciseId, (we) => {
            const previous = we.sets.at(-1);
            // New sets inherit the unit and type of the set above (warm-ups excepted).
            const setType = previous && previous.setType !== 'WARMUP' ? previous.setType : 'WORKING';
            return { ...we, sets: [...we.sets, newSet(previous?.weightUnit ?? 'LB', setType)] };
          }),
        })),

      removeSet: (workoutExerciseId, setId) =>
        set(({ active }) => ({
          active: updateExercise(active, workoutExerciseId, (we) => ({ ...we, sets: we.sets.filter((s) => s.id !== setId) })),
        })),

      updateSet: (workoutExerciseId, setId, patch) =>
        set(({ active }) => ({
          active: updateExercise(active, workoutExerciseId, (we) => ({
            ...we,
            sets: we.sets.map((s) => (s.id === setId ? { ...s, ...patch } : s)),
          })),
        })),

      toggleComplete: (workoutExerciseId, setId, fallback) => {
        const exercise = get().active?.exercises.find((we) => we.id === workoutExerciseId);
        const current = exercise?.sets.find((s) => s.id === setId);
        if (!current) return false;

        if (current.completedAt) {
          set(({ active }) => ({
            active: updateExercise(active, workoutExerciseId, (we) => ({
              ...we,
              sets: we.sets.map((s) => (s.id === setId ? { ...s, completedAt: null } : s)),
            })),
          }));
          return true;
        }

        const weight = current.weight.trim() || fallback?.weight || '';
        const reps = current.reps.trim() || fallback?.reps || '';
        const validWeight = weight !== '' && parseNumber(weight) >= 0 && !Number.isNaN(parseNumber(weight));
        const validReps = reps !== '' && Number.isInteger(Number(reps)) && Number(reps) >= 0;
        if (!validWeight || !validReps) return false;

        set(({ active }) => ({
          active: updateExercise(active, workoutExerciseId, (we) => ({
            ...we,
            sets: we.sets.map((s) =>
              s.id === setId ? { ...s, weight, reps, completedAt: new Date().toISOString() } : s,
            ),
          })),
        }));
        return true;
      },

      finish: () => {
        const active = get().active;
        if (!active) return null;
        const now = new Date().toISOString();
        const request: WorkoutRequest = {
          name: active.name.trim() || defaultWorkoutName(new Date(active.startedAt)),
          startedAt: active.startedAt,
          // Editing an old workout must not move its end time to "now".
          endedAt: active.editing ? active.editing.endedAt : now,
          notes: null,
          updatedAt: now,
          // Only completed sets are saved; exercises left with no completed sets are dropped.
          exercises: active.exercises
            .map((we) => ({
              id: we.id,
              exerciseId: we.exercise.id,
              notes: we.notes.trim() || null,
              sets: we.sets
                .filter((s) => s.completedAt)
                .map((s) => ({
                  id: s.id,
                  setType: s.setType,
                  weight: parseNumber(s.weight),
                  weightUnit: s.weightUnit,
                  reps: Number(s.reps),
                  rpe: null,
                  completedAt: s.completedAt,
                })),
            }))
            .filter((we) => we.sets.length > 0),
        };
        set({ active: null });
        return { id: active.id, request };
      },
    }),
    {
      name: 'progression.active-workout',
      storage: createJSONStorage(() => AsyncStorage),
      version: 1,
    },
  ),
);

/** Counts used by the Finish confirmation. */
export function workoutProgress(active: ActiveWorkout) {
  const sets = active.exercises.flatMap((we) => we.sets);
  return { completed: sets.filter((s) => s.completedAt).length, total: sets.length };
}
