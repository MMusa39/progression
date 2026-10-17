/** Saved recipes: open one to edit it, or start a new one. Logging happens from "Add food". */
import { router, Stack } from 'expo-router';
import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';

import { Button, Card, EmptyState, Icon, Screen, Text } from '@/components/ui';
import { useRecipes } from '@/features/food/queries';
import { space } from '@/theme/tokens';
import { useTheme } from '@/theme/useTheme';

export default function RecipesScreen() {
  const { colors } = useTheme();
  const recipes = useRecipes();
  const newRecipe = () => router.push({ pathname: '/food/recipe/[id]', params: { id: 'new' } });

  if (recipes.isPending) return <ActivityIndicator style={{ flex: 1 }} />;
  if (!recipes.data?.length) {
    return (
      <>
        <Stack.Screen options={{ title: 'Recipes' }} />
        <EmptyState
          icon="book-outline"
          title="No recipes yet"
          message="Save meals you make often, like overnight oats or a chicken rice bowl, and log them in one tap."
          action={<Button title="New recipe" fullWidth={false} onPress={newRecipe} />}
        />
      </>
    );
  }

  return (
    <Screen edges={['bottom']} footer={<Button title="New recipe" onPress={newRecipe} />}>
      <Stack.Screen options={{ title: 'Recipes' }} />
      <Card style={{ padding: 0, gap: 0 }}>
        {recipes.data.map((r, i) => (
          <Pressable
            key={r.id}
            onPress={() => router.push({ pathname: '/food/recipe/[id]', params: { id: r.id } })}
            accessibilityRole="button"
            style={[styles.row, i > 0 && { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border }]}>
            <View style={{ flex: 1, gap: 2 }}>
              <Text variant="headline">{r.name}</Text>
              <Text variant="footnote" color="textSecondary">
                {Math.round(r.perServing.kcal)} kcal · {Math.round(r.perServing.proteinG)} g protein per serving · {r.servings}{' '}
                {r.servings === 1 ? 'serving' : 'servings'}
              </Text>
            </View>
            <Icon name="chevron-forward" size={18} color="textTertiary" />
          </Pressable>
        ))}
      </Card>
    </Screen>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: space.md, padding: space.lg },
});
