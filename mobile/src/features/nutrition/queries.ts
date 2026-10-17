import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { apiRequest } from '@/features/api/client';
import type { ActivityLevel, NutritionProfile, Sex, TargetsResponse, WeightUnit } from '@/features/api/types';
import { localDate } from '@/lib/dates';

export const nutritionKeys = {
  all: ['nutrition'] as const,
  profile: ['nutrition', 'profile'] as const,
  targets: (today: string) => ['nutrition', 'targets', today] as const,
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
