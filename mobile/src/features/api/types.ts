/**
 * TypeScript mirrors of the API's JSON contract (see docs/api.md and
 * /swagger-ui.html). Timestamps are ISO-8601 strings; ids are UUID strings.
 */

export type WeightUnit = 'LB' | 'KG';
export type SetType = 'WARMUP' | 'WORKING' | 'DROP' | 'FAILURE';
export type MuscleGroup =
  | 'CHEST' | 'BACK' | 'SHOULDERS' | 'BICEPS' | 'TRICEPS' | 'FOREARMS'
  | 'QUADS' | 'HAMSTRINGS' | 'GLUTES' | 'CALVES' | 'CORE' | 'FULL_BODY';
export type Equipment =
  | 'BARBELL' | 'DUMBBELL' | 'MACHINE' | 'CABLE' | 'BODYWEIGHT'
  | 'KETTLEBELL' | 'SMITH_MACHINE' | 'BAND' | 'OTHER';

export type User = {
  id: string;
  email: string | null;
  displayName: string | null;
  weightUnit: WeightUnit;
  createdAt: string;
};

export type Exercise = {
  id: string;
  name: string;
  muscleGroup: MuscleGroup;
  equipment: Equipment;
  custom: boolean;
};

export type WorkoutSet = {
  id: string;
  setType: SetType;
  weight: number;
  weightUnit: WeightUnit;
  reps: number;
  rpe: number | null;
  completedAt: string | null;
};

export type Workout = {
  id: string;
  name: string;
  startedAt: string;
  endedAt: string | null;
  notes: string | null;
  updatedAt: string;
  exercises: {
    id: string;
    exerciseId: string;
    exerciseName: string;
    muscleGroup: MuscleGroup;
    equipment: Equipment;
    notes: string | null;
    sets: WorkoutSet[];
  }[];
};

/** Body of PUT /workouts/{id}: the complete workout, ordered by array position. */
export type WorkoutRequest = {
  name: string;
  startedAt: string;
  endedAt: string | null;
  notes: string | null;
  updatedAt: string;
  exercises: {
    id: string;
    exerciseId: string;
    notes: string | null;
    sets: WorkoutSet[];
  }[];
};

export type WorkoutSummary = {
  id: string;
  name: string;
  startedAt: string;
  endedAt: string | null;
  exerciseNames: string[];
  setCount: number;
  totalVolumeKg: number;
};

export type Page<T> = { items: T[]; nextCursor: string | null };

export type LastPerformance = {
  workoutId: string;
  workoutName: string;
  performedAt: string;
  sets: WorkoutSet[];
};

/** RFC 9457 error body returned by the API. */
export type ProblemDetail = {
  title?: string;
  status?: number;
  detail?: string;
  errors?: { field: string; message: string }[];
};
