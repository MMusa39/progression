import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { apiRequest } from '@/features/api/client';
import type { Routine } from '@/features/api/types';

export const routineKeys = {
  all: ['routines'] as const,
  one: (id: string) => ['routines', id] as const,
};

export function useRoutines() {
  return useQuery({ queryKey: routineKeys.all, queryFn: () => apiRequest<Routine[]>('/api/v1/routines') });
}

export function useRoutine(id: string | undefined) {
  return useQuery({ queryKey: routineKeys.one(id ?? ''), queryFn: () => apiRequest<Routine>(`/api/v1/routines/${id}`), enabled: Boolean(id) });
}

export type RoutineInput = {
  id: string;
  name: string;
  notes?: string | null;
  exercises: { exerciseId: string; sets: number; repMin: number; repMax: number }[];
};

export function useSaveRoutine() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...body }: RoutineInput) => apiRequest<Routine>(`/api/v1/routines/${id}`, { method: 'PUT', body }),
    onSuccess: (routine) => {
      queryClient.setQueryData(routineKeys.one(routine.id), routine);
      queryClient.invalidateQueries({ queryKey: routineKeys.all, exact: true });
    },
  });
}

export function useDeleteRoutine() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => apiRequest<void>(`/api/v1/routines/${id}`, { method: 'DELETE' }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: routineKeys.all }),
  });
}
