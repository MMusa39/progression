import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { apiRequest } from '@/features/api/client';
import type { BodyWeightHistory, WeightUnit } from '@/features/api/types';
import { localDate } from '@/lib/dates';

export const bodyKeys = {
  all: ['body'] as const,
  history: (from: string | null) => ['body', 'history', from] as const,
};

export function useBodyWeights(from: string | null) {
  return useQuery({
    queryKey: bodyKeys.history(from),
    queryFn: () => apiRequest<BodyWeightHistory>(`/api/v1/body-weights${from ? `?from=${from}` : ''}`),
    placeholderData: keepPreviousData,
  });
}

/** Saving or deleting a weigh-in also changes calorie targets (they follow the trend), so both refresh. */
function useInvalidateBody() {
  const queryClient = useQueryClient();
  return () => {
    queryClient.invalidateQueries({ queryKey: bodyKeys.all });
    queryClient.invalidateQueries({ queryKey: ['nutrition'] });
  };
}

export function useLogWeight() {
  const invalidate = useInvalidateBody();
  return useMutation({
    mutationFn: ({ date, weight, unit }: { date: string; weight: number; unit: WeightUnit }) =>
      apiRequest<void>(`/api/v1/body-weights/${date}`, { method: 'PUT', body: { weight, weightUnit: unit, today: localDate() } }),
    onSuccess: invalidate,
  });
}

export function useDeleteWeight() {
  const invalidate = useInvalidateBody();
  return useMutation({
    mutationFn: (date: string) => apiRequest<void>(`/api/v1/body-weights/${date}`, { method: 'DELETE' }),
    onSuccess: invalidate,
  });
}
