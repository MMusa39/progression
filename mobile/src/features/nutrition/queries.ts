import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { apiRequest } from '@/features/api/client';
import type { ActivityLevel, CustomMacros, NutritionProfile, NutritionTrends, Sex, TargetsResponse, WeightUnit } from '@/features/api/types';
import { localDate } from '@/lib/dates';

export const nutritionKeys = {
  all: ['nutrition'] as const,
  profile: ['nutrition', 'profile'] as const,
  targets: (today: string) => ['nutrition', 'targets', today] as const,
  trends: (from: string | null, today: string) => ['nutrition', 'trends', from, today] as const,
};

/** The goal profile, or null until the user has set one up (API answers 204). */
export function useNutritionProfile() {
  return useQuery({
    queryKey: nutritionKeys.profile,
    queryFn: async () => (await apiRequest<NutritionProfile | undefined>('/api/v1/nutrition/profile')) ?? null,
  });
}

export function useTargets() {
  const today = localDate();
  return useQuery({
    queryKey: nutritionKeys.targets(today),
    queryFn: async () => (await apiRequest<TargetsResponse | undefined>(`/api/v1/nutrition/targets?today=${today}`)) ?? null,
  });
}

export type ProfileInput = {
  sex: Sex;
  birthYear: number;
  heightCm: number;
  activityLevel: ActivityLevel;
  goalWeight: number;
  weightUnit: WeightUnit;
  goalDate: string;
  adaptive: boolean;
  currentWeight?: number;
  /** Your own macros, or null for calculated targets. */
  customMacros: CustomMacros | null;
};

export function useSaveProfile() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: ProfileInput) =>
      apiRequest<NutritionProfile>('/api/v1/nutrition/profile', { method: 'PUT', body: { ...input, today: localDate() } }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: nutritionKeys.all });
      queryClient.invalidateQueries({ queryKey: ['body'] });
    },
  });
}

/** Intake vs. targets from `from` (null: since the first logged day) to today. */
export function useNutritionTrends(from: string | null) {
  const today = localDate();
  return useQuery({
    queryKey: nutritionKeys.trends(from, today),
    queryFn: () =>
      apiRequest<NutritionTrends>(`/api/v1/nutrition/trends?today=${today}${from ? `&from=${from}` : ''}`),
    placeholderData: keepPreviousData,
  });
}
