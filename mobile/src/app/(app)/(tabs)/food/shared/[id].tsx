/** A recipe a friend shared: what's in it, and a button to save your own copy. */
import { randomUUID } from 'expo-crypto';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { ActivityIndicator, Alert, StyleSheet, View } from 'react-native';

import { Button, Card, EmptyState, Screen, Text } from '@/components/ui';
import { NutritionPreview } from '@/features/food/NutritionPreview';
import { useCopyRecipe, useSharedRecipe } from '@/features/food/queries';
import { sharerName } from '@/features/food/sharer';
import { space } from '@/theme/tokens';
import { useTheme } from '@/theme/useTheme';

export default function SharedRecipeScreen() {
  const { colors } = useTheme();
  const { id } = useLocalSearchParams<{ id: string }>();
  const recipe = useSharedRecipe(id);
  const copy = useCopyRecipe();

  if (recipe.isPending) return <ActivityIndicator style={{ flex: 1 }} />;
  if (!recipe.data) {
    return <EmptyState icon="alert-circle-outline" title="Recipe unavailable" message="Your friend may have stopped sharing it." />;
  }
  const r = recipe.data;

  const save = () =>
    copy.mutate(
      { sourceId: r.id, id: randomUUID() },
      {
        onSuccess: (mine) =>
          Alert.alert('Saved to your recipes', 'Log it any time from Add food → Recipes.', [
            { text: 'Done', style: 'cancel' },
            { text: 'Edit my copy', onPress: () => router.push({ pathname: '/food/recipe/[id]', params: { id: mine.id } }) },
          ]),
        onError: (e) => Alert.alert("Couldn't save", e.message),
      },
    );

  return (
    <Screen
      edges={['bottom']}
      footer={
        r.savedCopyId ? (
          <Button
            title="Open my copy"
            variant="secondary"
            onPress={() => router.push({ pathname: '/food/recipe/[id]', params: { id: r.savedCopyId! } })}
          />
        ) : (
          <Button title="Save to my recipes" onPress={save} loading={copy.isPending} />
        )
      }>
      <Stack.Screen options={{ title: 'Recipe' }} />
      <View style={{ gap: 2 }}>
        <Text variant="title2">{r.name}</Text>
        {r.sharedBy && (
          <Text variant="subhead" color="textSecondary">
            Shared by {sharerName(r.sharedBy)} · makes {r.servings} {r.servings === 1 ? 'serving' : 'servings'}
          </Text>
        )}
      </View>

      <Text variant="footnote" weight="600" color="textSecondary">
        PER SERVING
      </Text>
      <NutritionPreview nutrients={r.perServing} />

      <Text variant="footnote" weight="600" color="textSecondary">
        INGREDIENTS
      </Text>
      <Card style={{ padding: 0, gap: 0 }}>
        {r.ingredients.map((ing, i) => (
          <View key={`${ing.food.id}-${i}`} style={[styles.row, i > 0 && { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border }]}>
            <View style={{ flex: 1, gap: 2 }}>
              <Text variant="subhead" weight="600" numberOfLines={1}>
                {ing.food.name}
              </Text>
              <Text variant="footnote" color="textSecondary">
                {Math.round(ing.nutrients.kcal)} kcal
              </Text>
            </View>
            <Text variant="subhead" color="textSecondary">
              {Math.round(ing.grams)} g
            </Text>
          </View>
        ))}
      </Card>
    </Screen>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: space.md, paddingHorizontal: space.lg, paddingVertical: space.md },
});
