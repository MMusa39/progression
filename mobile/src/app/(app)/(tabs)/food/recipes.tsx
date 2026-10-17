/**
 * Recipes: your own (open to edit, or start a new one) and the ones friends
 * have shared (open to see and save a copy). Logging happens from "Add food".
 */
import { router, Stack } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';

import { Button, Card, EmptyState, Icon, Screen, SegmentedControl, Text } from '@/components/ui';
import type { Recipe } from '@/features/api/types';
import { useRecipes, useSharedRecipes } from '@/features/food/queries';
import { sharerName } from '@/features/food/sharer';
import { space } from '@/theme/tokens';
import { useTheme } from '@/theme/useTheme';

type Tab = 'mine' | 'friends';

export default function RecipesScreen() {
  const [tab, setTab] = useState<Tab>('mine');
  const mine = useRecipes();
  const shared = useSharedRecipes();
  const newRecipe = () => router.push({ pathname: '/food/recipe/[id]', params: { id: 'new' } });
  const query = tab === 'mine' ? mine : shared;

  return (
    <Screen edges={['bottom']} footer={tab === 'mine' ? <Button title="New recipe" onPress={newRecipe} /> : undefined}>
      <Stack.Screen options={{ title: 'Recipes' }} />
      <SegmentedControl<Tab>
        accessibilityLabel="Recipe list"
        options={[
          { value: 'mine', label: 'Mine' },
          { value: 'friends', label: 'From friends' },
        ]}
        value={tab}
        onChange={setTab}
      />
      {query.isPending ? (
        <ActivityIndicator style={{ marginTop: space.xl }} />
      ) : !query.data?.length ? (
        tab === 'mine' ? (
          <EmptyState
            icon="book-outline"
            title="No recipes yet"
            message="Save meals you make often, like overnight oats or a chicken rice bowl, and log them in one tap."
          />
        ) : (
          <EmptyState
            icon="people-outline"
            title="Nothing shared yet"
            message="When friends share a recipe, it shows up here. Share yours from the recipe editor."
          />
        )
      ) : (
        <RecipeList
          recipes={query.data}
          onOpen={(r) =>
            tab === 'mine'
              ? router.push({ pathname: '/food/recipe/[id]', params: { id: r.id } })
              : router.push({ pathname: '/food/shared/[id]', params: { id: r.id } })
          }
        />
      )}
    </Screen>
  );
}

function RecipeList({ recipes, onOpen }: { recipes: Recipe[]; onOpen: (recipe: Recipe) => void }) {
  const { colors } = useTheme();
  return (
    <Card style={{ padding: 0, gap: 0 }}>
      {recipes.map((r, i) => (
        <Pressable
          key={r.id}
          onPress={() => onOpen(r)}
          accessibilityRole="button"
          style={[styles.row, i > 0 && { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border }]}>
          <View style={{ flex: 1, gap: 2 }}>
            <Text variant="headline">{r.name}</Text>
            <Text variant="footnote" color="textSecondary">
              {r.sharedBy ? `by ${sharerName(r.sharedBy)} · ` : ''}
              {Math.round(r.perServing.kcal)} kcal · {Math.round(r.perServing.proteinG)} g protein per serving
            </Text>
          </View>
          {r.shared && !r.sharedBy && <Icon name="people-outline" size={16} color="textTertiary" />}
          {r.savedCopyId && <Icon name="checkmark-circle" size={18} color="accentText" />}
          <Icon name="chevron-forward" size={18} color="textTertiary" />
        </Pressable>
      ))}
    </Card>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: space.md, padding: space.lg },
});
