/** One of your past workouts: details, personal records, and repeat / edit / delete. */
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { ActivityIndicator, Alert, ScrollView, StyleSheet, View } from 'react-native';

import { Button, EmptyState, Text } from '@/components/ui';
import { useDeleteWorkout, useWeightUnit, useWorkout, useWorkoutRecords } from '@/features/api/queries';
import { PersonalRecordList } from '@/features/progress/records';
import { WorkoutDetail } from '@/features/workout/components/WorkoutDetail';
import { unitLabel } from '@/features/workout/format';
import { useStartWorkout } from '@/features/workout/useStartWorkout';
import { space } from '@/theme/tokens';

export default function WorkoutDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const workout = useWorkout(id);
  const unit = useWeightUnit();
  const remove = useDeleteWorkout();
  const records = useWorkoutRecords(id);
  const { repeat, editSaved } = useStartWorkout();

  if (workout.isPending) return <ActivityIndicator style={{ flex: 1 }} />;
  if (workout.isError) {
    return <EmptyState icon="alert-circle-outline" title="Workout not found" message={workout.error.message} />;
  }

  const data = workout.data;
  const recordSetIds = new Set((records.data ?? []).map((r) => r.setId).filter(Boolean));
  const confirmDelete = () =>
    Alert.alert('Delete workout?', 'This permanently removes the workout and its sets from your history.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: () => remove.mutate(id, { onSuccess: () => router.back() }) },
    ]);

  return (
    <ScrollView contentInsetAdjustmentBehavior="automatic" contentContainerStyle={styles.content}>
      <Stack.Screen options={{ title: data.name }} />
      <WorkoutDetail
        workout={data}
        recordSetIds={recordSetIds}
        header={
          records.data && records.data.length > 0 ? (
            <View style={{ gap: space.sm }}>
              <Text variant="title2">Personal records</Text>
              <PersonalRecordList records={records.data} unit={unit} />
            </View>
          ) : null
        }
      />
      <Button title="Repeat this workout" icon="repeat" onPress={() => repeat(id)} />
      <Button title="Edit workout" variant="secondary" icon="create-outline" onPress={() => editSaved(data)} />
      <Button
        title="Save as routine"
        variant="secondary"
        icon="bookmark-outline"
        onPress={() => router.push({ pathname: '/routine/[id]', params: { id: 'new', from: id } })}
      />
      <Button title="Delete workout" variant="danger" icon="trash-outline" onPress={confirmDelete} loading={remove.isPending} />
      <Text variant="caption" color="textTertiary" align="center">
        Weights shown in the unit they were logged ({[...new Set(data.exercises.flatMap((e) => e.sets.map((s) => unitLabel(s.weightUnit))))].join(', ') || unitLabel(unit)}).
      </Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { padding: space.lg, gap: space.md, paddingBottom: space.xxxl },
});
