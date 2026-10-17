/**
 * Choose how much of a food (or recipe) to log and to which meal, with the
 * nutrition updating live. Also used to edit or delete an existing entry.
 */
import { randomUUID } from 'expo-crypto';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, Alert, StyleSheet, TextInput, View } from 'react-native';

import { Button, EmptyState, Screen, SegmentedControl, Text } from '@/components/ui';
import type { AmountUnit, Meal, Nutrients } from '@/features/api/types';
import { MealPicker } from '@/features/food/MealPicker';
import { mealForNow } from '@/features/food/meals';
import { NutritionPreview } from '@/features/food/NutritionPreview';
import { nutrientsFor, useDeleteEntry, useFood, useRecipe, useSaveEntry } from '@/features/food/queries';
import { localDate } from '@/lib/dates';
import { radius, space } from '@/theme/tokens';
import { useTheme } from '@/theme/useTheme';

export default function FoodItemScreen() {
  const { colors } = useTheme();
  const p = useLocalSearchParams<{ foodId?: string; recipeId?: string; meal?: Meal; date?: string; entryId?: string; amount?: string; unit?: AmountUnit }>();
  const food = useFood(p.foodId);
  const recipe = useRecipe(p.recipeId);
  const save = useSaveEntry();
  const remove = useDeleteEntry();
  const date = p.date ?? localDate();

  const [meal, setMeal] = useState<Meal>(p.meal ?? mealForNow());
  const [unitChoice, setUnitChoice] = useState<AmountUnit | null>(p.unit ?? null);
  const [amountText, setAmountText] = useState<string | null>(p.amount ?? null);

  const loading = (p.foodId && food.isPending) || (p.recipeId && recipe.isPending);
  if (loading) return <ActivityIndicator style={{ flex: 1 }} />;
  const item = food.data ?? recipe.data;
  if (!item) return <EmptyState icon="alert-circle-outline" title="Food not found" message="It may have been deleted." />;

  const isRecipe = Boolean(recipe.data);
  const canServe = isRecipe || Boolean(food.data?.servingG);
  const unit: AmountUnit = isRecipe ? 'SERVING' : unitChoice ?? (canServe ? 'SERVING' : 'G');
  const defaultAmount = unit === 'G' ? String(food.data?.servingG ?? 100) : '1';
  const text = amountText ?? defaultAmount;
  const amount = Number(text.replace(',', '.'));
  const valid = amount > 0 && amount <= 10_000;

  const nutrients: Nutrients = recipe.data
    ? scale(recipe.data.perServing, valid ? amount : 0)
    : nutrientsFor(food.data!, valid ? amount : 0, unit);

  const submit = () =>
    save.mutate(
      {
        id: p.entryId ?? randomUUID(),
        entry: {
          date,
          meal,
          kind: isRecipe ? 'RECIPE' : 'FOOD',
          ...(isRecipe ? { recipeId: recipe.data!.id } : { foodId: food.data!.id }),
          amount,
          amountUnit: unit,
        },
      },
      { onSuccess: () => router.dismissTo('/food'), onError: (e) => Alert.alert("Couldn't save", e.message) },
    );

  const servingHint = food.data?.servingG
    ? `1 serving = ${food.data.servingLabel ? `${food.data.servingLabel}, ` : ''}${food.data.servingG} g`
    : recipe.data
      ? `Recipe makes ${recipe.data.servings} serving${recipe.data.servings === 1 ? '' : 's'}`
      : 'No serving size on file. Log by weight.';

  return (
    <Screen
      edges={['bottom']}
      footer={
        <>
          <Button title={p.entryId ? 'Save changes' : 'Log food'} onPress={submit} disabled={!valid} loading={save.isPending} />
          {p.entryId && (
            <Button title="Delete" variant="ghost" onPress={() => remove.mutate({ id: p.entryId!, date }, { onSuccess: () => router.back() })} />
          )}
        </>
      }>
      <Stack.Screen options={{ title: p.entryId ? 'Edit Entry' : 'Log Food' }} />
      <View style={{ gap: 2 }}>
        <Text variant="title2">{'name' in item ? item.name : ''}</Text>
        {food.data?.brand && (
          <Text variant="subhead" color="textSecondary">
            {food.data.brand}
          </Text>
        )}
      </View>

      <View style={styles.amountRow}>
        <View style={[styles.amountBox, { backgroundColor: colors.inputBackground, borderColor: colors.border }]}>
          <TextInput
            value={text}
            onChangeText={(t) => setAmountText(t.replace(/[^0-9.,]/g, ''))}
            keyboardType="decimal-pad"
            selectTextOnFocus
            autoFocus={!p.entryId}
            accessibilityLabel={unit === 'G' ? 'Grams' : 'Servings'}
            selectionColor={colors.accentText}
            style={[styles.amountInput, { color: colors.text }]}
          />
        </View>
        {canServe && !isRecipe ? (
          <View style={{ flex: 1 }}>
            <SegmentedControl<AmountUnit>
              accessibilityLabel="Unit"
              options={[
                { value: 'SERVING', label: 'Servings' },
                { value: 'G', label: 'Grams' },
              ]}
              value={unit}
              onChange={(u) => {
                setUnitChoice(u);
                setAmountText(null);
              }}
            />
          </View>
        ) : (
          <Text variant="title2" color="textSecondary">
            {unit === 'G' ? 'g' : 'servings'}
          </Text>
        )}
      </View>
      <Text variant="footnote" color="textTertiary">
        {servingHint}
      </Text>

      <NutritionPreview nutrients={nutrients} />
      <MealPicker value={meal} onChange={setMeal} />
    </Screen>
  );
}

function scale(n: Nutrients, f: number): Nutrients {
  return { kcal: n.kcal * f, proteinG: n.proteinG * f, carbsG: n.carbsG * f, fatG: n.fatG * f, fiberG: n.fiberG * f };
}

const styles = StyleSheet.create({
  amountRow: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  amountBox: { width: 130, borderWidth: 1.5, borderRadius: radius.md, paddingHorizontal: space.md },
  amountInput: { minWidth: 0, fontSize: 34, fontWeight: '800', paddingVertical: space.sm },
});
