/**
 * Data hooks built on TanStack Query. Screens use these instead of calling the
 * API directly, and get caching, deduplication, background refresh, and
 * loading/error state for free.
 *
 * Query keys are centralized in `queryKeys` so that mutations can invalidate
 * exactly the data they change.
 */
import {
  useInfiniteQuery,
  useMutation,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query';

import { apiRequest } from './client';
import type { Exercise, LastPerformance, MuscleGroup, Equipment, Page, User, WeightUnit, Workout, WorkoutSummary } from './types';

export const queryKeys = {
  me: ['me'] as const,
  exercises: ['exercises'] as const,
  workouts: ['workouts'] as const,
  workout: (id: string) => ['workouts', id] as const,
  lastPerformance: (exerciseId: string, excludeWorkoutId?: string) =>
    ['last-performance', exerciseId, excludeWorkoutId ?? null] as const,
};

// ------------------------------------------------------------------ user

export function useMe() {
  return useQuery({
    queryKey: queryKeys.me,
    queryFn: () => apiRequest<User>('/api/v1/me'),
    staleTime: 5 * 60_000,
  });
}

/** Preferred weight unit, defaulting to pounds until the profile has loaded. */
export function useWeightUnit(): WeightUnit {
  return useMe().data?.weightUnit ?? 'LB';
}

export function useUpdateMe() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (patch: { displayName?: string; weightUnit?: WeightUnit }) =>
      apiRequest<User>('/api/v1/me', { method: 'PATCH', body: patch }),
    onSuccess: (user) => queryClient.setQueryData(queryKeys.me, user),
  });
}

// ------------------------------------------------------------------ exercises

/**
 * The full exercise list (catalog + custom). It's small (~100 rows), so it's
 * fetched once and filtered on the device, which keeps search instant as you type.
 */
export function useExercises() {
  return useQuery({
    queryKey: queryKeys.exercises,
    queryFn: () => apiRequest<Exercise[]>('/api/v1/exercises'),
    staleTime: 60 * 60_000,
  });
}

export function useCreateExercise() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: { name: string; muscleGroup: MuscleGroup; equipment: Equipment }) =>
      apiRequest<Exercise>('/api/v1/exercises', { method: 'POST', body: input }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.exercises }),
  });
}

export function useLastPerformance(exerciseId: string, excludeWorkoutId?: string) {
  return useQuery({
    queryKey: queryKeys.lastPerformance(exerciseId, excludeWorkoutId),
    queryFn: async () => {
      const query = excludeWorkoutId ? `?excludeWorkoutId=${excludeWorkoutId}` : '';
      // 204 No Content (never performed) comes back as undefined; normalize to null for React Query.
      return (await apiRequest<LastPerformance | undefined>(`/api/v1/exercises/${exerciseId}/last-performance${query}`)) ?? null;
    },
    staleTime: 10 * 60_000,
  });
}

// ------------------------------------------------------------------ workouts

const PAGE_SIZE = 20;

/** Workout history, newest first, loaded page by page as the list scrolls. */
export function useWorkoutHistory() {
  return useInfiniteQuery({
    queryKey: queryKeys.workouts,
    queryFn: ({ pageParam }) =>
      apiRequest<Page<WorkoutSummary>>(
        `/api/v1/workouts?limit=${PAGE_SIZE}${pageParam ? `&cursor=${encodeURIComponent(pageParam)}` : ''}`,
      ),
    initialPageParam: null as string | null,
    getNextPageParam: (lastPage) => lastPage.nextCursor,
  });
}

export function useWorkout(id: string) {
  return useQuery({
    queryKey: queryKeys.workout(id),
    queryFn: () => apiRequest<Workout>(`/api/v1/workouts/${id}`),
  });
}

export function useDeleteWorkout() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => apiRequest<void>(`/api/v1/workouts/${id}`, { method: 'DELETE' }),
    onSuccess: (_, id) => {
      queryClient.removeQueries({ queryKey: queryKeys.workout(id) });
      queryClient.invalidateQueries({ queryKey: queryKeys.workouts });
      queryClient.invalidateQueries({ queryKey: ['last-performance'] });
    },
  });
}
