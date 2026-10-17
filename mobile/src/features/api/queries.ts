/**
 * Data hooks built on TanStack Query. Screens use these instead of calling the
 * API directly, and get caching, deduplication, background refresh, and
 * loading/error state for free.
 *
 * Query keys are centralized in `queryKeys` so that mutations can invalidate
 * exactly the data they change.
 */
import {
  keepPreviousData,
  useInfiniteQuery,
  useMutation,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query';

import { apiRequest } from './client';
import type {
  ConnectResult,
  ConsistencyEntry,
  Equipment,
  Exercise,
  ExerciseProgression,
  ExerciseStats,
  Friend,
  FriendRequests,
  LastPerformance,
  LeaderboardExercise,
  MuscleGroup,
  Page,
  PersonalRecord,
  RecentRecord,
  StatsSummary,
  StrengthEntry,
  User,
  UserSearchResult,
  UserSummary,
  WeightUnit,
  Workout,
  WorkoutSummary,
} from './types';

export const queryKeys = {
  me: ['me'] as const,
  exercises: ['exercises'] as const,
  workouts: ['workouts'] as const,
  workout: (id: string) => ['workouts', id] as const,
  lastPerformance: (exerciseId: string, excludeWorkoutId?: string) =>
    ['last-performance', exerciseId, excludeWorkoutId ?? null] as const,
  workoutRecords: (id: string) => ['workouts', id, 'records'] as const,
  /** Everything under ['stats'] is invalidated whenever workouts change. */
  stats: ['stats'] as const,
  statsSummary: (from: string | null, tz: string) => ['stats', 'summary', from, tz] as const,
  exerciseStats: (from: string | null) => ['stats', 'exercises', from] as const,
  recentRecords: (from: string | null) => ['stats', 'records', from] as const,
  progression: (exerciseId: string, from: string | null) => ['stats', 'progression', exerciseId, from] as const,
  /** Everything under ['social'] is refreshed after any friend action. */
  social: ['social'] as const,
  friends: ['social', 'friends'] as const,
  friend: (id: string) => ['social', 'friends', id] as const,
  friendRecords: (id: string) => ['social', 'friends', id, 'records'] as const,
  friendWorkouts: (id: string) => ['social', 'friends', id, 'workouts'] as const,
  friendWorkout: (friendId: string, workoutId: string) => ['social', 'friends', friendId, 'workouts', workoutId] as const,
  friendRequests: ['social', 'requests'] as const,
  userSearch: (q: string) => ['social', 'search', q] as const,
  invite: ['social', 'invite'] as const,
  invitePreview: (code: string) => ['social', 'invite', code] as const,
  consistencyBoard: ['social', 'leaderboards', 'consistency'] as const,
  strengthExercises: ['social', 'leaderboards', 'strength-exercises'] as const,
  strengthBoard: (exerciseId: string | null) => ['social', 'leaderboards', 'strength', exerciseId] as const,
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
    mutationFn: (patch: Partial<Pick<User, 'displayName' | 'weightUnit' | 'shareWorkouts' | 'notifyFriendRequests' | 'notifyFriendPrs'>> & { username?: string }) =>
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
    enabled: id.length > 0,
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
      queryClient.invalidateQueries({ queryKey: queryKeys.stats });
    },
  });
}

// ------------------------------------------------------------------ stats

const withFrom = (path: string, fromIso: string | null, extra = '') => {
  const params = [extra, fromIso ? `from=${encodeURIComponent(fromIso)}` : ''].filter(Boolean).join('&');
  return params ? `${path}?${params}` : path;
};

/**
 * Stats hooks use `placeholderData: keepPreviousData`: while a new range loads,
 * the previous range's content stays on screen (dimmed by the screen), so
 * switching ranges never flashes empty.
 */
export function useStatsSummary(from: Date | null, tz: string) {
  const fromIso = from?.toISOString() ?? null;
  return useQuery({
    queryKey: queryKeys.statsSummary(fromIso, tz),
    queryFn: () => apiRequest<StatsSummary>(withFrom('/api/v1/stats/summary', fromIso, `tz=${encodeURIComponent(tz)}`)),
    placeholderData: keepPreviousData,
  });
}

/** Exercises performed in the range, with how they moved and their all-time bests. */
export function useExerciseStats(from: Date | null) {
  const fromIso = from?.toISOString() ?? null;
  return useQuery({
    queryKey: queryKeys.exerciseStats(fromIso),
    queryFn: () => apiRequest<ExerciseStats[]>(withFrom('/api/v1/stats/exercises', fromIso)),
    placeholderData: keepPreviousData,
  });
}

/** Personal records set within the range, newest first. */
export function useRecentRecords(from: Date | null) {
  const fromIso = from?.toISOString() ?? null;
  return useQuery({
    queryKey: queryKeys.recentRecords(fromIso),
    queryFn: () => apiRequest<RecentRecord[]>(withFrom('/api/v1/stats/records', fromIso)),
    placeholderData: keepPreviousData,
  });
}

export function useExerciseProgression(exerciseId: string, from: Date | null) {
  const fromIso = from?.toISOString() ?? null;
  return useQuery({
    queryKey: queryKeys.progression(exerciseId, fromIso),
    queryFn: () => apiRequest<ExerciseProgression>(withFrom(`/api/v1/stats/exercises/${exerciseId}/progression`, fromIso)),
    placeholderData: keepPreviousData,
  });
}

/** Personal records set in a workout. Disabled until the workout has been uploaded. */
export function useWorkoutRecords(workoutId: string, enabled = true) {
  return useQuery({
    queryKey: queryKeys.workoutRecords(workoutId),
    queryFn: () => apiRequest<PersonalRecord[]>(`/api/v1/workouts/${workoutId}/records`),
    enabled,
  });
}

// ------------------------------------------------------------------ friends

const tzParam = () => {
  try {
    return encodeURIComponent(Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC');
  } catch {
    return 'UTC';
  }
};

export function useFriends() {
  return useQuery({ queryKey: queryKeys.friends, queryFn: () => apiRequest<Friend[]>(`/api/v1/friends?tz=${tzParam()}`) });
}

export function useFriend(friendId: string) {
  return useQuery({
    queryKey: queryKeys.friend(friendId),
    queryFn: () => apiRequest<Friend>(`/api/v1/friends/${friendId}?tz=${tzParam()}`),
  });
}

export function useFriendRecords(friendId: string, from: Date | null) {
  return useQuery({
    queryKey: [...queryKeys.friendRecords(friendId), from?.toISOString() ?? null],
    queryFn: () =>
      apiRequest<RecentRecord[]>(withFrom(`/api/v1/friends/${friendId}/records`, from?.toISOString() ?? null)),
  });
}

/** A friend's workout history; disabled when they share PRs only. */
export function useFriendWorkouts(friendId: string, enabled: boolean) {
  return useInfiniteQuery({
    queryKey: queryKeys.friendWorkouts(friendId),
    queryFn: ({ pageParam }) =>
      apiRequest<Page<WorkoutSummary>>(
        `/api/v1/friends/${friendId}/workouts?limit=${PAGE_SIZE}${pageParam ? `&cursor=${encodeURIComponent(pageParam)}` : ''}`,
      ),
    initialPageParam: null as string | null,
    getNextPageParam: (lastPage) => lastPage.nextCursor,
    enabled,
  });
}

export function useFriendWorkout(friendId: string, workoutId: string) {
  return useQuery({
    queryKey: queryKeys.friendWorkout(friendId, workoutId),
    queryFn: () => apiRequest<Workout>(`/api/v1/friends/${friendId}/workouts/${workoutId}`),
  });
}

export function useFriendRequests() {
  return useQuery({ queryKey: queryKeys.friendRequests, queryFn: () => apiRequest<FriendRequests>('/api/v1/friends/requests') });
}

export function useUserSearch(query: string) {
  const q = query.trim().replace(/^@/, '');
  return useQuery({
    queryKey: queryKeys.userSearch(q),
    queryFn: () => apiRequest<UserSearchResult[]>(`/api/v1/users/search?q=${encodeURIComponent(q)}`),
    enabled: q.length >= 2,
    placeholderData: keepPreviousData,
  });
}

export function useInvite() {
  return useQuery({ queryKey: queryKeys.invite, queryFn: () => apiRequest<{ code: string }>('/api/v1/friends/invite') });
}

export function useInvitePreview(code: string) {
  return useQuery({
    queryKey: queryKeys.invitePreview(code),
    queryFn: () => apiRequest<{ user: UserSummary; relationship: ConnectResult['relationship'] }>(`/api/v1/friends/invite/${code}`),
    retry: false,
  });
}

export function useConsistencyBoard() {
  return useQuery({
    queryKey: queryKeys.consistencyBoard,
    queryFn: () => apiRequest<{ entries: ConsistencyEntry[] }>(`/api/v1/leaderboards/consistency?tz=${tzParam()}`),
  });
}

export function useStrengthExercises() {
  return useQuery({
    queryKey: queryKeys.strengthExercises,
    queryFn: () => apiRequest<LeaderboardExercise[]>('/api/v1/leaderboards/strength/exercises'),
  });
}

export function useStrengthBoard(exerciseId: string | null) {
  return useQuery({
    queryKey: queryKeys.strengthBoard(exerciseId),
    queryFn: () =>
      apiRequest<{ exercise: LeaderboardExercise | null; entries: StrengthEntry[] }>(
        `/api/v1/leaderboards/strength${exerciseId ? `?exerciseId=${exerciseId}` : ''}`,
      ),
    placeholderData: keepPreviousData,
  });
}

/**
 * All friend actions (send / accept / decline / cancel / unfriend / use invite / reset invite)
 * share one mutation hook. Each action refreshes everything social afterwards, since one
 * action can change several screens (requests, friends list, leaderboards).
 */
export type FriendAction =
  | { type: 'send'; username: string }
  | { type: 'accept'; requestId: string }
  | { type: 'removeRequest'; requestId: string }
  | { type: 'unfriend'; friendId: string }
  | { type: 'useInvite'; code: string }
  | { type: 'resetInvite' };

export function useFriendAction() {
  const queryClient = useQueryClient();
  return useMutation<ConnectResult | { code: string } | void, Error, FriendAction>({
    mutationFn: (action) => {
      switch (action.type) {
        case 'send':
          return apiRequest<ConnectResult>('/api/v1/friends/requests', { method: 'POST', body: { username: action.username } });
        case 'accept':
          return apiRequest<ConnectResult>(`/api/v1/friends/requests/${action.requestId}/accept`, { method: 'POST' });
        case 'removeRequest':
          return apiRequest<void>(`/api/v1/friends/requests/${action.requestId}`, { method: 'DELETE' });
        case 'unfriend':
          return apiRequest<void>(`/api/v1/friends/${action.friendId}`, { method: 'DELETE' });
        case 'useInvite':
          return apiRequest<ConnectResult>(`/api/v1/friends/invite/${encodeURIComponent(action.code.trim().toUpperCase())}`, { method: 'POST' });
        case 'resetInvite':
          return apiRequest<{ code: string }>('/api/v1/friends/invite/reset', { method: 'POST' });
      }
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.social }),
  });
}
