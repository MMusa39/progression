/**
 * The recipe being edited. Adding an ingredient goes through the regular
 * food search screen, which drops the chosen food into this draft and returns.
 */
import { create } from 'zustand';

import type { Food, Recipe } from '@/features/api/types';

export type DraftIngredient = { food: Food; grams: number };

type RecipeDraftState = {
  id: string | null;
  name: string;
  servings: number;
  ingredients: DraftIngredient[];
  load: (id: string, recipe?: Recipe) => void;
  setName: (name: string) => void;
  setServings: (servings: number) => void;
  addIngredient: (food: Food) => void;
  setGrams: (index: number, grams: number) => void;
  removeIngredient: (index: number) => void;
};

export const useRecipeDraft = create<RecipeDraftState>()((set) => ({
  id: null,
  name: '',
  servings: 1,
  ingredients: [],
  load: (id, recipe) =>
    set({
      id,
      name: recipe?.name ?? '',
      servings: recipe?.servings ?? 1,
      ingredients: recipe?.ingredients.map((i) => ({ food: i.food, grams: i.grams })) ?? [],
    }),
  setName: (name) => set({ name }),
  setServings: (servings) => set({ servings }),
  // Default amount: one serving if the food has one, otherwise 100 g.
  addIngredient: (food) => set((s) => ({ ingredients: [...s.ingredients, { food, grams: food.servingG ?? 100 }] })),
  setGrams: (index, grams) => set((s) => ({ ingredients: s.ingredients.map((i, n) => (n === index ? { ...i, grams } : i)) })),
  removeIngredient: (index) => set((s) => ({ ingredients: s.ingredients.filter((_, n) => n !== index) })),
}));
