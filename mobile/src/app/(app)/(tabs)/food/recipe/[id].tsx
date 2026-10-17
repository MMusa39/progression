/**
 * Recipe editor. Ingredients are foods with gram amounts; the total is divided
 * into servings. Adding an ingredient reuses the food search/scan screens.
 */
import { randomUUID } from 'expo-crypto';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, StyleSheet, Switch, TextInput, View } from 'react-native';

import { Button, Card, Icon, Screen, Text, TextField } from '@/components/ui';
import { NutritionPreview } from '@/features/food/NutritionPreview';
import { nutrientsFor, useDeleteRecipe, useRecipe, useSaveRecipe } from '@/features/food/queries';
import { useRecipeDraft } from '@/features/food/recipeDraft';
import { radius, space } from '@/theme/tokens';
import { useTheme } from '@/theme/useTheme';

export default function RecipeEditorScreen() {
  const { colors } = useTheme();
  const { id } = useLocalSearchParams<{ id: string }>();
  const isNew = id === 'new';
  const existing = useRecipe(isNew ? undefined : id);
  const save = useSaveRecipe();
  const remove = useDeleteRecipe();
  const draft = useRecipeDraft();
  const [servingsText, setServingsText] = useState<string | null>(null);

  // Start the draft once: a fresh id for a new recipe, or the saved recipe's contents.
  const ready = draft.id !== null && (isNew || draft.id === id);
  useEffect(() => {
    if (isNew) useRecipeDraft.getState().load(randomUUID());
    else if (existing.data) useRecipeDraft.getState().load(existing.data.id, existing.data);
  }, [isNew, existing.data]);

  if (!ready) return <ActivityIndicator style={{ flex: 1 }} />;

  const servings = servingsText === null ? draft.servings : Number(servingsText.replace(',', '.'));
  const total = draft.ingredients.reduce(
    (sum, i) => {
      const n = nutrientsFor(i.food, i.grams, 'G');
      return { kcal: sum.kcal + n.kcal, proteinG: sum.proteinG + n.proteinG, carbsG: sum.carbsG + n.carbsG, fatG: sum.fatG + n.fatG, fiberG: sum.fiberG + n.fiberG };
    },
    { kcal: 0, proteinG: 0, carbsG: 0, fatG: 0, fiberG: 0 },
  );
  const div = servings > 0 ? servings : 1;
  const perServing = { kcal: total.kcal / div, proteinG: total.proteinG / div, carbsG: total.carbsG / div, fatG: total.fatG / div, fiberG: total.fiberG / div };
  const valid = draft.name.trim().length > 0 && servings > 0 && servings <= 100 && draft.ingredients.length > 0 && draft.ingredients.every((i) => i.grams > 0);

  const submit = () =>
    save.mutate(
      {
        id: draft.id!,
        name: draft.name.trim(),
        servings,
        shared: draft.shared,
        ingredients: draft.ingredients.map((i) => ({ foodId: i.food.id, grams: i.grams })),
      },
      { onSuccess: () => router.back(), onError: (e) => Alert.alert("Couldn't save", e.message) },
    );

  const confirmDelete = () =>
    Alert.alert('Delete recipe?', 'Past diary entries keep their nutrition.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: () => remove.mutate(draft.id!, { onSuccess: () => router.back() }) },
    ]);

  return (
    <Screen
      edges={['bottom']}
      footer={
        <>
          <Button title="Save recipe" onPress={submit} disabled={!valid} loading={save.isPending} />
          {!isNew && <Button title="Delete" variant="ghost" onPress={confirmDelete} />}
        </>
      }>
      <Stack.Screen options={{ title: isNew ? 'New Recipe' : 'Edit Recipe' }} />
      <TextField label="Name" value={draft.name} onChangeText={draft.setName} placeholder="e.g. Chicken rice bowl" />
      <TextField
        label="Servings it makes"
        value={servingsText ?? String(draft.servings)}
        onChangeText={(t) => {
          setServingsText(t);
          const n = Number(t.replace(',', '.'));
          if (n > 0) draft.setServings(n);
        }}
        keyboardType="decimal-pad"
      />

      <Text variant="footnote" weight="600" color="textSecondary">
        PER SERVING
      </Text>
      <NutritionPreview nutrients={perServing} />

      <Text variant="footnote" weight="600" color="textSecondary">
        INGREDIENTS
      </Text>
      {draft.ingredients.length > 0 && (
        <Card style={{ padding: 0, gap: 0 }}>
          {draft.ingredients.map((ing, index) => (
            <View key={`${ing.food.id}-${index}`} style={[styles.row, index > 0 && { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border }]}>
              <View style={{ flex: 1, gap: 2 }}>
                <Text variant="subhead" weight="600" numberOfLines={1}>
                  {ing.food.name}
                </Text>
                <Text variant="footnote" color="textSecondary">
                  {Math.round(nutrientsFor(ing.food, ing.grams, 'G').kcal)} kcal
                </Text>
              </View>
              <GramsInput value={ing.grams} onChange={(g) => draft.setGrams(index, g)} />
              <Pressable onPress={() => draft.removeIngredient(index)} hitSlop={10} accessibilityRole="button" accessibilityLabel={`Remove ${ing.food.name}`}>
                <Icon name="close-circle" size={22} color="textTertiary" />
              </Pressable>
            </View>
          ))}
        </Card>
      )}
      <Button
        title="Add ingredient"
        variant="secondary"
        onPress={() => router.push({ pathname: '/food/add', params: { mode: 'ingredient' } })}
      />

      <View style={styles.shareRow}>
        <View style={{ flex: 1, gap: 2 }}>
          <Text variant="body" weight="600">
            Share with friends
          </Text>
          <Text variant="footnote" color="textSecondary">
            Friends can see this recipe and save a copy. Your diary stays private.
          </Text>
        </View>
        <Switch
          value={draft.shared}
          onValueChange={draft.setShared}
          trackColor={{ true: colors.accent }}
          accessibilityLabel="Share with friends"
        />
      </View>
    </Screen>
  );
}

function GramsInput({ value, onChange }: { value: number; onChange: (grams: number) => void }) {
  const { colors } = useTheme();
  const [text, setText] = useState(String(value));
  return (
    <View style={[styles.grams, { backgroundColor: colors.inputBackground, borderColor: colors.border }]}>
      <TextInput
        value={text}
        onChangeText={(t) => {
          const clean = t.replace(/[^0-9.,]/g, '');
          setText(clean);
          onChange(Number(clean.replace(',', '.')) || 0);
        }}
        keyboardType="decimal-pad"
        selectTextOnFocus
        accessibilityLabel="Grams"
        style={[styles.gramsInput, { color: colors.text }]}
      />
      <Text variant="footnote" color="textSecondary">
        g
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: space.md, paddingHorizontal: space.lg, paddingVertical: space.md },
  shareRow: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  grams: { flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderRadius: radius.sm, paddingHorizontal: space.sm, width: 84 },
  gramsInput: { flex: 1, minWidth: 0, fontSize: 17, fontWeight: '600', paddingVertical: 6, textAlign: 'right', marginRight: 2 },
});
