/** Nutrition trends from the Food tab: the same view as Progress → Nutrition, with its own range control. */
import { useQueryClient } from '@tanstack/react-query';
import { Stack } from 'expo-router';
import { useState } from 'react';
import { RefreshControl, ScrollView, StyleSheet } from 'react-native';

import { NutritionOverview } from '@/features/nutrition/NutritionOverview';
import { RangeFilter } from '@/features/progress/RangeFilter';
import { space } from '@/theme/tokens';

export default function NutritionTrendsScreen() {
  const queryClient = useQueryClient();
  const [refreshing, setRefreshing] = useState(false);
  const refresh = async () => {
    setRefreshing(true);
    await queryClient.invalidateQueries({ queryKey: ['nutrition'] });
    setRefreshing(false);
  };
  return (
    <ScrollView
      contentInsetAdjustmentBehavior="automatic"
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} />}>
      <Stack.Screen options={{ title: 'Trends' }} />
      <RangeFilter />
      <NutritionOverview />
    </ScrollView>
  );
}

const styles = StyleSheet.create({ content: { padding: space.lg, gap: space.lg, paddingBottom: space.xxxl } });
