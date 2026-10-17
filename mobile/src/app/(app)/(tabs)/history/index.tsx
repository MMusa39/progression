/** Workout history: infinite list, newest first, pull to refresh. */
import { router } from 'expo-router';
import { ActivityIndicator, FlatList, RefreshControl, StyleSheet, View } from 'react-native';

import { Button, EmptyState, Text } from '@/components/ui';
import { useWeightUnit, useWorkoutHistory } from '@/features/api/queries';
import { WorkoutSummaryCard } from '@/features/workout/components/WorkoutSummaryCard';
import { useStartWorkout } from '@/features/workout/useStartWorkout';
import { space } from '@/theme/tokens';

export default function HistoryScreen() {
  const history = useWorkoutHistory();
  const unit = useWeightUnit();
  const { startEmpty } = useStartWorkout();
  const workouts = history.data?.pages.flatMap((page) => page.items) ?? [];

  if (history.isPending) {
    return <ActivityIndicator style={styles.loading} />;
  }

  return (
    <FlatList
      data={workouts}
      keyExtractor={(item) => item.id}
      contentInsetAdjustmentBehavior="automatic"
      contentContainerStyle={styles.content}
      renderItem={({ item }) => (
        <WorkoutSummaryCard workout={item} unit={unit} onPress={() => router.push(`/history/${item.id}`)} />
      )}
      onEndReached={() => history.hasNextPage && !history.isFetchingNextPage && history.fetchNextPage()}
      onEndReachedThreshold={0.5}
      refreshControl={<RefreshControl refreshing={history.isRefetching && !history.isFetchingNextPage} onRefresh={() => void history.refetch()} />}
      ListFooterComponent={history.isFetchingNextPage ? <ActivityIndicator style={{ margin: space.lg }} /> : undefined}
      ListEmptyComponent={
        history.isError ? (
          <EmptyState
            icon="cloud-offline-outline"
            title="Couldn't load history"
            message={history.error.message}
            action={<Button title="Try again" variant="secondary" fullWidth={false} onPress={() => history.refetch()} />}
          />
        ) : (
          <EmptyState
            icon="calendar-outline"
            title="No workouts yet"
            message="Finished workouts show up here, so you can always look back at what you lifted."
            action={<Button title="Start a workout" icon="add" fullWidth={false} onPress={startEmpty} />}
          />
        )
      }
      ListHeaderComponent={
        workouts.length > 0 ? (
          <View style={{ paddingBottom: space.xs }}>
            <Text variant="footnote" color="textSecondary">
              {workouts.length}
              {history.hasNextPage ? '+' : ''} workouts
            </Text>
          </View>
        ) : undefined
      }
    />
  );
}

const styles = StyleSheet.create({
  loading: { flex: 1 },
  content: { padding: space.lg, gap: space.md, paddingBottom: space.xxxl, flexGrow: 1 },
});
