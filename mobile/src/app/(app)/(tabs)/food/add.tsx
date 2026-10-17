/**
 * Find something to log: search (your foods + Open Food Facts), scan a
 * barcode, recent foods, your own foods, recipes, quick add, or create a food.
 *
 * In ingredient mode (from the recipe editor), picking a food adds it to the
 * recipe draft instead of opening the logging screen.
 */
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';

import { Icon, SegmentedControl, Text } from '@/components/ui';
import type { Food, Meal, RecentFoodItem, Recipe } from '@/features/api/types';
import { amountLabel, mealLabel } from '@/features/food/meals';
import { useFoodSearch, useMyFoods, useRecentFoods, useRecipes } from '@/features/food/queries';
import { useRecipeDraft } from '@/features/food/recipeDraft';
import { hitTarget, radius, space, typography } from '@/theme/tokens';
import { useTheme } from '@/theme/useTheme';

type Tab = 'recent' | 'mine' | 'recipes';

export default function AddFoodScreen() {
  const { colors } = useTheme();
  const params = useLocalSearchParams<{ meal?: Meal; date?: string; mode?: 'ingredient' }>();
  const ingredientMode = params.mode === 'ingredient';
  const [query, setQuery] = useState('');
  const [tab, setTab] = useState<Tab>('recent');
  const search = useFoodSearch(query);
  const searching = query.trim().length >= 2;

  const pickFood = (food: Food, last?: { amount: number; unit: 'G' | 'SERVING' }) => {
    if (ingredientMode) {
      useRecipeDraft.getState().addIngredient(food);
      router.back();
      return;
    }
    router.push({
      pathname: '/food/item',
      params: {
        foodId: food.id,
        meal: params.meal,
        date: params.date,
        ...(last ? { amount: String(last.amount), unit: last.unit } : {}),
      },
    });
  };
  const pickRecipe = (recipe: Recipe, lastAmount?: number) =>
    router.push({
      pathname: '/food/item',
      params: { recipeId: recipe.id, meal: params.meal, date: params.date, ...(lastAmount ? { amount: String(lastAmount), unit: 'SERVING' } : {}) },
    });

  const title = ingredientMode ? 'Add Ingredient' : params.meal ? `Add to ${mealLabel[params.meal]}` : 'Add Food';

  return (
    <ScrollView contentInsetAdjustmentBehavior="automatic" contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
      <Stack.Screen options={{ title }} />
      <View style={[styles.search, { backgroundColor: colors.surfaceRaised }]}>
        <Icon name="search" size={18} color="textTertiary" />
        <TextInput
          value={query}
          onChangeText={setQuery}
          placeholder="Search foods or brands"
          placeholderTextColor={colors.textTertiary}
          autoCorrect={false}
          returnKeyType="search"
          clearButtonMode="while-editing"
          style={[typography.body, styles.searchInput, { color: colors.text }]}
          accessibilityLabel="Search foods"
        />
      </View>

      <View style={styles.actions}>
        <Action icon="barcode-outline" label="Scan" onPress={() => router.push({ pathname: '/food/scan', params: { meal: params.meal, date: params.date, mode: params.mode } })} />
        {!ingredientMode && <Action icon="flash-outline" label="Quick add" onPress={() => router.push({ pathname: '/food/quick', params: { meal: params.meal, date: params.date } })} />}
        <Action icon="create-outline" label="New food" onPress={() => router.push({ pathname: '/food/custom', params: { meal: params.meal, date: params.date, mode: params.mode } })} />
      </View>

      {searching ? (
        <Results loading={search.isPending} empty={search.data?.length === 0} emptyText={`Nothing found for "${query.trim()}". Try another word, or create the food.`}>
          {search.data?.map((food) => <FoodRow key={food.id} food={food} onPress={() => pickFood(food)} />)}
        </Results>
      ) : (
        <>
          <SegmentedControl<Tab>
            accessibilityLabel="Food list"
            options={[
              { value: 'recent', label: 'Recent' },
              { value: 'mine', label: 'My foods' },
              ...(ingredientMode ? [] : [{ value: 'recipes' as Tab, label: 'Recipes' }]),
            ]}
            value={tab}
            onChange={setTab}
          />
          {tab === 'recent' && <RecentList ingredientMode={ingredientMode} onFood={pickFood} onRecipe={pickRecipe} />}
          {tab === 'mine' && <MyFoods onFood={pickFood} />}
          {tab === 'recipes' && <RecipeList onRecipe={(r) => pickRecipe(r)} />}
        </>
      )}
    </ScrollView>
  );
}

function RecentList({ ingredientMode, onFood, onRecipe }: {
  ingredientMode: boolean;
  onFood: (food: Food, last: { amount: number; unit: 'G' | 'SERVING' }) => void;
  onRecipe: (recipe: Recipe, lastAmount: number) => void;
}) {
  const recent = useRecentFoods();
  const items = (recent.data ?? []).filter((i) => !ingredientMode || i.kind === 'FOOD');
  return (
    <Results loading={recent.isPending} empty={items.length === 0} emptyText="Foods you log show up here for one-tap re-logging.">
      {items.map((item: RecentFoodItem) =>
        item.kind === 'FOOD' && item.food ? (
          <FoodRow
            key={item.food.id}
            food={item.food}
            subtitle={`Last: ${amountLabel(item.lastAmount, item.lastAmountUnit, item.food.servingLabel)}`}
            onPress={() => onFood(item.food!, { amount: item.lastAmount, unit: item.lastAmountUnit })}
          />
        ) : item.recipe ? (
          <RecipeRow key={item.recipe.id} recipe={item.recipe} onPress={() => onRecipe(item.recipe!, item.lastAmount)} />
        ) : null,
      )}
    </Results>
  );
}

function MyFoods({ onFood }: { onFood: (food: Food) => void }) {
  const mine = useMyFoods();
  return (
    <Results loading={mine.isPending} empty={mine.data?.length === 0} emptyText="Foods you create (or scan that aren't in the database) live here.">
      {mine.data?.map((food) => <FoodRow key={food.id} food={food} onPress={() => onFood(food)} />)}
    </Results>
  );
}

function RecipeList({ onRecipe }: { onRecipe: (recipe: Recipe) => void }) {
  const recipes = useRecipes();
  return (
    <Results loading={recipes.isPending} empty={recipes.data?.length === 0} emptyText="Save recipes from the book icon on the Food tab.">
      {recipes.data?.map((recipe) => <RecipeRow key={recipe.id} recipe={recipe} onPress={() => onRecipe(recipe)} />)}
    </Results>
  );
}

function Results({ loading, empty, emptyText, children }: { loading: boolean; empty: boolean; emptyText: string; children: React.ReactNode }) {
  const { colors } = useTheme();
  if (loading) return <ActivityIndicator style={{ marginTop: space.lg }} />;
  if (empty) {
    return (
      <Text variant="subhead" color="textSecondary" style={{ paddingHorizontal: space.xs }}>
        {emptyText}
      </Text>
    );
  }
  return <View style={[styles.panel, { backgroundColor: colors.surface, borderColor: colors.border }]}>{children}</View>;
}

function FoodRow({ food, subtitle, onPress }: { food: Food; subtitle?: string; onPress: () => void }) {
  const { colors } = useTheme();
  const serving = food.servingG ? Math.round((food.per100g.kcal * food.servingG) / 100) : null;
  return (
    <Pressable onPress={onPress} accessibilityRole="button" style={({ pressed }) => [styles.row, { borderTopColor: colors.border }, pressed && { backgroundColor: colors.surfaceRaised }]}>
      <View style={{ flex: 1, gap: 2 }}>
        <Text variant="body" numberOfLines={1}>
          {food.name}
        </Text>
        <Text variant="footnote" color="textSecondary" numberOfLines={1}>
          {subtitle ?? [food.brand, serving !== null ? `${serving} kcal per ${food.servingLabel ?? `${food.servingG} g`}` : `${Math.round(food.per100g.kcal)} kcal per 100 g`].filter(Boolean).join(' · ')}
        </Text>
      </View>
      {food.custom && <Icon name="person-outline" size={14} color="textTertiary" />}
      <Icon name="add-circle-outline" size={22} color="accentText" />
    </Pressable>
  );
}

function RecipeRow({ recipe, onPress }: { recipe: Recipe; onPress: () => void }) {
  const { colors } = useTheme();
  return (
    <Pressable onPress={onPress} accessibilityRole="button" style={({ pressed }) => [styles.row, { borderTopColor: colors.border }, pressed && { backgroundColor: colors.surfaceRaised }]}>
      <Icon name="book-outline" size={18} color="textSecondary" />
      <View style={{ flex: 1, gap: 2 }}>
        <Text variant="body" numberOfLines={1}>
          {recipe.name}
        </Text>
        <Text variant="footnote" color="textSecondary">
          Recipe · {Math.round(recipe.perServing.kcal)} kcal per serving
        </Text>
      </View>
      <Icon name="add-circle-outline" size={22} color="accentText" />
    </Pressable>
  );
}

function Action({ icon, label, onPress }: { icon: 'barcode-outline' | 'flash-outline' | 'create-outline'; label: string; onPress: () => void }) {
  const { colors } = useTheme();
  return (
    <Pressable onPress={onPress} accessibilityRole="button" style={({ pressed }) => [styles.action, { backgroundColor: colors.surface, borderColor: colors.border }, pressed && { opacity: 0.8 }]}>
      <Icon name={icon} size={22} color="accentText" />
      <Text variant="footnote" weight="600">
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  content: { padding: space.lg, gap: space.lg, paddingBottom: space.xxxl },
  search: { flexDirection: 'row', alignItems: 'center', gap: space.sm, paddingHorizontal: space.md, borderRadius: radius.md, minHeight: hitTarget.min },
  searchInput: { flex: 1, paddingVertical: space.sm },
  actions: { flexDirection: 'row', gap: space.sm },
  action: { flex: 1, alignItems: 'center', gap: space.xs, paddingVertical: space.md, borderRadius: radius.md, borderWidth: StyleSheet.hairlineWidth },
  panel: { borderRadius: radius.lg, borderWidth: StyleSheet.hairlineWidth, overflow: 'hidden' },
  row: { flexDirection: 'row', alignItems: 'center', gap: space.md, paddingHorizontal: space.lg, paddingVertical: space.md, borderTopWidth: StyleSheet.hairlineWidth, marginTop: -StyleSheet.hairlineWidth },
});
