import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { apiRequest } from '@/features/api/client';
import type { DiaryDay, DiaryEntry, EntryRequest, Food, Nutrients, RecentFoodItem, Recipe } from '@/features/api/types';

export const foodKeys = {
  day: (date: string) => ['diary', date] as const,
  food: (id: string) => ['food', id] as const,
  search: (q: string) => ['food', 'search', q] as const,
  recent: ['food', 'recent'] as const,
  mine: ['food', 'mine'] as const,
  recipes: ['recipes'] as const,
  recipe: (id: string) => ['recipes', id] as const,
  sharedRecipes: ['sharedRecipes'] as const,
  sharedRecipe: (id: string) => ['sharedRecipes', id] as const,
};

export function useDiaryDay(date: string) {
  return useQuery({
    queryKey: foodKeys.day(date),
    queryFn: () => apiRequest<DiaryDay>(`/api/v1/diary/${date}`),
    placeholderData: keepPreviousData,
  });
}

export function useFood(id: string | undefined) {
  return useQuery({ queryKey: foodKeys.food(id ?? ''), queryFn: () => apiRequest<Food>(`/api/v1/foods/${id}`), enabled: Boolean(id) });
}

export function useFoodSearch(query: string) {
  const q = query.trim();
  return useQuery({
    queryKey: foodKeys.search(q.toLowerCase()),
    queryFn: () => apiRequest<Food[]>(`/api/v1/foods/search?q=${encodeURIComponent(q)}`),
    enabled: q.length >= 2,
    placeholderData: keepPreviousData,
    staleTime: 5 * 60_000,
  });
}

export function useRecentFoods() {
  return useQuery({ queryKey: foodKeys.recent, queryFn: () => apiRequest<RecentFoodItem[]>('/api/v1/foods/recent') });
}

export function useMyFoods() {
  return useQuery({ queryKey: foodKeys.mine, queryFn: () => apiRequest<Food[]>('/api/v1/foods/mine') });
}

export function useRecipes() {
  return useQuery({ queryKey: foodKeys.recipes, queryFn: () => apiRequest<Recipe[]>('/api/v1/recipes') });
}

export function useRecipe(id: string | undefined) {
  return useQuery({ queryKey: foodKeys.recipe(id ?? ''), queryFn: () => apiRequest<Recipe>(`/api/v1/recipes/${id}`), enabled: Boolean(id) });
}

/** Diary changes refresh that day, recent foods, and targets (adaptive targets use intake). */
function useInvalidateDiary() {
  const queryClient = useQueryClient();
  return (date: string) => {
    queryClient.invalidateQueries({ queryKey: foodKeys.day(date) });
    queryClient.invalidateQueries({ queryKey: foodKeys.recent });
    queryClient.invalidateQueries({ queryKey: ['nutrition'] });
  };
}

export function useSaveEntry() {
  const invalidate = useInvalidateDiary();
  return useMutation({
    mutationFn: ({ id, entry }: { id: string; entry: EntryRequest }) =>
      apiRequest<DiaryEntry>(`/api/v1/diary/entries/${id}`, { method: 'PUT', body: entry }),
    onSuccess: (_, { entry }) => invalidate(entry.date),
  });
}

export function useDeleteEntry() {
  const invalidate = useInvalidateDiary();
  return useMutation({
    mutationFn: ({ id }: { id: string; date: string }) => apiRequest<void>(`/api/v1/diary/entries/${id}`, { method: 'DELETE' }),
    onSuccess: (_, { date }) => invalidate(date),
  });
}

export function useCopyMeal() {
  const invalidate = useInvalidateDiary();
  return useMutation({
    mutationFn: ({ date, fromDate, meal }: { date: string; fromDate: string; meal?: string }) =>
      apiRequest<DiaryDay>(`/api/v1/diary/${date}/copy`, { method: 'POST', body: { fromDate, meal } }),
    onSuccess: (_, { date }) => invalidate(date),
  });
}

export function useSetWater() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ date, ml }: { date: string; ml: number }) => apiRequest<{ ml: number }>(`/api/v1/diary/${date}/water`, { method: 'PUT', body: { ml } }),
    // Optimistic: water taps should feel instant.
    onMutate: ({ date, ml }) => {
      queryClient.setQueryData<DiaryDay>(foodKeys.day(date), (day) => (day ? { ...day, waterMl: ml } : day));
    },
    onSettled: (_, __, { date }) => queryClient.invalidateQueries({ queryKey: foodKeys.day(date) }),
  });
}

export function useCreateFood() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: {
      name: string;
      brand?: string;
      barcode?: string;
      servingG: number;
      servingLabel?: string;
      perServingValues: { kcal: number; proteinG?: number; carbsG?: number; fatG?: number; fiberG?: number };
    }) => apiRequest<Food>('/api/v1/foods', { method: 'POST', body: input }),
    onSuccess: (food) => {
      queryClient.setQueryData(foodKeys.food(food.id), food);
      queryClient.invalidateQueries({ queryKey: foodKeys.mine });
    },
  });
}

export function useSaveRecipe() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...body }: { id: string; name: string; servings: number; shared: boolean; ingredients: { foodId: string; grams: number }[] }) =>
      apiRequest<Recipe>(`/api/v1/recipes/${id}`, { method: 'PUT', body }),
    onSuccess: (recipe) => {
      queryClient.setQueryData(foodKeys.recipe(recipe.id), recipe);
      queryClient.invalidateQueries({ queryKey: foodKeys.recipes });
    },
  });
}

export function useDeleteRecipe() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => apiRequest<void>(`/api/v1/recipes/${id}`, { method: 'DELETE' }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: foodKeys.recipes }),
  });
}

/** Recipes friends have shared with you. */
export function useSharedRecipes() {
  return useQuery({ queryKey: foodKeys.sharedRecipes, queryFn: () => apiRequest<Recipe[]>('/api/v1/recipes/shared') });
}

export function useSharedRecipe(id: string | undefined) {
  return useQuery({
    queryKey: foodKeys.sharedRecipe(id ?? ''),
    queryFn: () => apiRequest<Recipe>(`/api/v1/recipes/shared/${id}`),
    enabled: Boolean(id),
  });
}

/** Save your own copy of a friend's recipe (saving twice returns the same copy). */
export function useCopyRecipe() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ sourceId, id }: { sourceId: string; id: string }) =>
      apiRequest<Recipe>(`/api/v1/recipes/shared/${sourceId}/copy`, { method: 'POST', body: { id } }),
    onSuccess: (recipe) => {
      queryClient.setQueryData(foodKeys.recipe(recipe.id), recipe);
      queryClient.invalidateQueries({ queryKey: foodKeys.recipes });
      queryClient.invalidateQueries({ queryKey: foodKeys.sharedRecipes });
      queryClient.invalidateQueries({ queryKey: foodKeys.mine });
    },
  });
}

export async function lookupBarcode(code: string): Promise<Food | null> {
  try {
    return await apiRequest<Food>(`/api/v1/foods/barcode/${encodeURIComponent(code)}`);
  } catch (error) {
    if (error instanceof Error && 'status' in error && (error as { status: number }).status === 404) return null;
    throw error;
  }
}

/** Nutrition for an amount of a food, mirroring the server's math (for the live preview while typing). */
export function nutrientsFor(food: Food, amount: number, unit: 'G' | 'SERVING'): Nutrients {
  const grams = unit === 'G' ? amount : amount * (food.servingG ?? 0);
  const f = grams / 100;
  const p = food.per100g;
  return { kcal: p.kcal * f, proteinG: p.proteinG * f, carbsG: p.carbsG * f, fatG: p.fatG * f, fiberG: p.fiberG * f };
}
