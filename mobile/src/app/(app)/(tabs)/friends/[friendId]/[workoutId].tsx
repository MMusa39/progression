/** One of a friend's workouts, read-only. */
import { Stack, useLocalSearchParams } from 'expo-router';
import { ActivityIndicator, ScrollView, StyleSheet } from 'react-native';

import { EmptyState } from '@/components/ui';
import { useFriendWorkout } from '@/features/api/queries';
import { WorkoutDetail } from '@/features/workout/components/WorkoutDetail';
import { space } from '@/theme/tokens';

export default function FriendWorkoutScreen() {
  const { friendId, workoutId } = useLocalSearchParams<{ friendId: string; workoutId: string }>();
  const workout = useFriendWorkout(friendId, workoutId);

  if (workout.isPending) return <ActivityIndicator style={{ flex: 1 }} />;
  if (workout.isError) return <EmptyState icon="lock-closed-outline" title="Can't show this workout" message={workout.error.message} />;

  return (
    <ScrollView contentInsetAdjustmentBehavior="automatic" contentContainerStyle={styles.content}>
      <Stack.Screen options={{ title: workout.data.name }} />
      <WorkoutDetail workout={workout.data} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({ content: { padding: space.lg, gap: space.md, paddingBottom: space.xxxl } });
