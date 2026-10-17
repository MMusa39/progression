/**
 * Weekly workout goal ("4 workouts a week"): a simple, motivating target shown
 * on the Workout tab. Stored on the phone; null means no goal.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

import type { WorkoutSummary } from '@/features/api/types';
import { weekStart } from '@/features/nutrition/trends';
import { localDate } from '@/lib/dates';

export const GOAL_OPTIONS = [2, 3, 4, 5, 6] as const;

type WeeklyGoalState = { goal: number | null; setGoal: (goal: number | null) => void };

export const useWeeklyGoal = create<WeeklyGoalState>()(
  persist((set) => ({ goal: null, setGoal: (goal) => set({ goal }) }), {
    name: 'weekly-goal',
    storage: createJSONStorage(() => AsyncStorage),
  }),
);

/** Workouts started this week (Monday to Sunday, local time), from the most recent history page. */
export function workoutsThisWeek(recent: Pick<WorkoutSummary, 'startedAt'>[], now = new Date()): number {
  const monday = weekStart(localDate(now));
  return recent.filter((w) => localDate(new Date(w.startedAt)) >= monday).length;
}
