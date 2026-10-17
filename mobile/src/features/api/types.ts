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
  /** Lowercase handle shown as @username; null until chosen. */
  username: string | null;
  weightUnit: WeightUnit;
  /** Whether friends can see individual workouts (PRs are always shared). */
  shareWorkouts: boolean;
  /** Push preferences (delivered only if the device has notification permission). */
  notifyFriendRequests: boolean;
  notifyFriendPrs: boolean;
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

// ------------------------------------------------------------------ stats

/** Consistency over a range: workouts logged (and in the previous period) plus the weekly streak. */
export type StatsSummary = {
  from: string | null;
  workouts: number;
  previousWorkouts: number | null;
  currentStreakWeeks: number;
};

/** An exercise performed in the range: per-session bests in the range, plus all-time records. */
export type ExerciseStats = {
  exerciseId: string;
  exerciseName: string;
  muscleGroup: MuscleGroup;
  equipment: Equipment;
  sessions: number;
  lastPerformedAt: string;
  rangeBestE1rmKg: number[];
  rangeBestReps: number[];
  bestE1rmKg: number;
  bestE1rmAt: string;
  heaviestWeightKg: number;
  bestReps: number;
};

export type ProgressionPoint = {
  workoutId: string;
  performedAt: string;
  bestE1rmKg: number;
  topSetWeightKg: number;
  topSetReps: number;
  bestReps: number;
  setCount: number;
};

export type ExerciseProgression = {
  exerciseId: string;
  exerciseName: string;
  muscleGroup: MuscleGroup;
  equipment: Equipment;
  points: ProgressionPoint[];
};

export type RecordType = 'ESTIMATED_1RM' | 'HEAVIEST_WEIGHT';

/** A record set in a specific workout (from /workouts/{id}/records). */
export type PersonalRecord = {
  exerciseId: string;
  exerciseName: string;
  type: RecordType;
  setId: string | null;
  valueKg: number;
  previousKg: number;
  weight: number | null;
  weightUnit: WeightUnit | null;
  reps: number | null;
};

/** A record set at some point in a range (from /stats/records). */
export type RecentRecord = {
  exerciseId: string;
  exerciseName: string;
  workoutId: string;
  achievedAt: string;
  type: RecordType;
  valueKg: number;
  previousKg: number;
  weight: number;
  weightUnit: WeightUnit;
  reps: number;
};

// ------------------------------------------------------------------ friends

export type UserSummary = { id: string; username: string | null; displayName: string | null };

export type Relationship = 'NONE' | 'REQUEST_SENT' | 'REQUEST_RECEIVED' | 'FRIENDS';

export type UserSearchResult = { user: UserSummary; relationship: Relationship };

export type FriendRequest = { id: string; user: UserSummary; createdAt: string };

export type FriendRequests = { incoming: FriendRequest[]; outgoing: FriendRequest[] };

export type Friend = {
  user: UserSummary;
  friendsSince: string;
  shareWorkouts: boolean;
  currentStreakWeeks: number;
  workoutsLast4Weeks: number;
  lastWorkoutAt: string | null;
};

export type ConnectResult = { user: UserSummary; relationship: Relationship };

export type ConsistencyEntry = {
  user: UserSummary;
  you: boolean;
  rank: number;
  winner: boolean;
  currentStreakWeeks: number;
  workoutsLast4Weeks: number;
};

export type LeaderboardExercise = { id: string; name: string; participants: number };

export type StrengthEntry = {
  user: UserSummary;
  you: boolean;
  rank: number;
  bestE1rmKg: number;
  weight: number;
  weightUnit: WeightUnit;
  reps: number;
  achievedAt: string;
};

// ------------------------------------------------------------------ body weight

export type BodyWeightEntry = { date: string; weight: number; weightUnit: WeightUnit; weightKg: number; trendKg: number };

export type BodyWeightHistory = {
  entries: BodyWeightEntry[];
  currentTrendKg: number | null;
  weeklyChangeKg: number | null;
  changeInRangeKg: number | null;
};

// ------------------------------------------------------------------ nutrition goals

export type Sex = 'MALE' | 'FEMALE' | 'UNSPECIFIED';
export type ActivityLevel = 'SEDENTARY' | 'LIGHT' | 'MODERATE' | 'ACTIVE' | 'VERY_ACTIVE';

export type NutritionProfile = {
  sex: Sex;
  birthYear: number;
  heightCm: number;
  activityLevel: ActivityLevel;
  goalWeightKg: number;
  goalDate: string;
  adaptive: boolean;
  /** The user's own macro targets; null when targets are calculated. */
  customMacros: CustomMacros | null;
};

export type CustomMacros = { proteinG: number; carbsG: number; fatG: number };

export type Targets = {
  calories: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
  fiberG: number;
  waterMl: number;
  bmr: number;
  formulaTdee: number;
  tdee: number;
  tdeeSource: 'FORMULA' | 'ADAPTIVE';
  dailyDeltaKcal: number;
  weeklyRateKg: number;
  goal: 'LOSE' | 'MAINTAIN' | 'GAIN';
  rateCapped: boolean;
  atCalorieFloor: boolean;
  projectedGoalDate: string | null;
  mode: 'CALCULATED' | 'CUSTOM';
};

export type TargetsResponse = {
  targets: Targets;
  currentWeightKg: number;
  goalWeightKg: number;
  goalDate: string;
  adaptiveLoggedDays: number;
};

/** Daily intake over a range vs. today's targets (GET /nutrition/trends). */
export type NutritionTrends = {
  from: string;
  to: string;
  /** Every day in the range; `intake` is null when nothing was logged. */
  days: { date: string; intake: Nutrients | null }[];
  goals: { calories: number; proteinG: number; carbsG: number; fatG: number; fiberG: number } | null;
  rules: { calorieTolerance: number; proteinMinimum: number; macroTolerance: number };
  summary: {
    finishedDays: number;
    loggedDays: number;
    loggingStreak: number;
    average: Nutrients | null;
    onTarget: { calories: number; protein: number; carbs: number; fat: number } | null;
  };
};

// ------------------------------------------------------------------ food

export type Nutrients = { kcal: number; proteinG: number; carbsG: number; fatG: number; fiberG: number };

export type Food = {
  id: string;
  name: string;
  brand: string | null;
  barcode: string | null;
  servingG: number | null;
  servingLabel: string | null;
  per100g: Nutrients;
  custom: boolean;
};

export type Recipe = {
  id: string;
  name: string;
  servings: number;
  ingredients: { food: Food; grams: number; nutrients: Nutrients }[];
  total: Nutrients;
  perServing: Nutrients;
  /** Visible to friends. */
  shared: boolean;
  /** Set on a friend's shared recipe: who shared it, and your saved copy if any. */
  sharedBy: { id: string; username: string | null; displayName: string | null } | null;
  savedCopyId: string | null;
};

export type Meal = 'BREAKFAST' | 'LUNCH' | 'DINNER' | 'SNACK';
export type AmountUnit = 'G' | 'SERVING';

export type DiaryEntry = {
  id: string;
  date: string;
  meal: Meal;
  kind: 'FOOD' | 'RECIPE' | 'QUICK';
  foodId: string | null;
  recipeId: string | null;
  name: string;
  amount: number;
  amountUnit: AmountUnit;
  nutrients: Nutrients;
};

export type DiaryDay = { date: string; entries: DiaryEntry[]; totals: Nutrients; waterMl: number };

export type RecentFoodItem = {
  kind: 'FOOD' | 'RECIPE';
  food: Food | null;
  recipe: Recipe | null;
  lastAmount: number;
  lastAmountUnit: AmountUnit;
};

export type EntryRequest = {
  date: string;
  meal: Meal;
  kind: DiaryEntry['kind'];
  foodId?: string;
  recipeId?: string;
  amount: number;
  amountUnit: AmountUnit;
  quick?: { name?: string; kcal: number; proteinG?: number; carbsG?: number; fatG?: number };
};
