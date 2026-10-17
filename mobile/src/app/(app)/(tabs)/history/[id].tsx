/** One past workout: stats, every exercise and set, plus repeat / delete. */
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { ActivityIndicator, Alert, ScrollView, StyleSheet, View } from 'react-native';

import { Button, Card, EmptyState, Icon, StatTile, Text } from '@/components/ui';
import { useDeleteWorkout, useWeightUnit, useWorkout, useWorkoutRecords } from '@/features/api/queries';
import type { Workout } from '@/features/api/types';
import { PersonalRecordList } from '@/features/progress/records';
import { formatDuration, formatSet, formatVolumeCompact, muscleGroupLabel, unitLabel } from '@/features/workout/format';
import { useStartWorkout } from '@/features/workout/useStartWorkout';
import { radius, space } from '@/theme/tokens';
import { useTheme } from '@/theme/useTheme';

const KG_PER_LB = 0.45359237;

export default function WorkoutDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const workout = useWorkout(id);
  const unit = useWeightUnit();
  const remove = useDeleteWorkout();
  const records = useWorkoutRecords(id);
  const { repeat } = useStartWorkout();
  const recordSetIds = new Set((records.data ?? []).map((r) => r.setId).filter(Boolean));

  if (workout.isPending) return <ActivityIndicator style={{ flex: 1 }} />;
  if (workout.isError) {
    return <EmptyState icon="alert-circle-outline" title="Workout not found" message={workout.error.message} />;
  }

  const data = workout.data;
  const stats = summarize(data);
  const confirmDelete = () =>
    Alert.alert('Delete workout?', 'This permanently removes the workout and its sets from your history.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: () => remove.mutate(id, { onSuccess: () => router.back() }),
      },
    ]);

  return (
    <ScrollView contentInsetAdjustmentBehavior="automatic" contentContainerStyle={styles.content}>
      <Stack.Screen options={{ title: data.name }} />
      <Text variant="subhead" color="textSecondary">
        {new Date(data.startedAt).toLocaleString(undefined, { weekday: 'long', month: 'long', day: 'numeric', hour: 'numeric', minute: '2-digit' })}
      </Text>

      <View style={styles.stats}>
        <StatTile label="Duration" value={formatDuration(data.startedAt, data.endedAt) ?? '—'} />
        <StatTile label="Sets" value={String(stats.sets)} />
        <StatTile label="Volume" value={formatVolumeCompact(stats.volumeKg, unit)} />
      </View>

      {records.data && records.data.length > 0 && (
        <View style={{ gap: space.sm }}>
          <Text variant="title2">Personal records</Text>
          <PersonalRecordList records={records.data} unit={unit} />
        </View>
      )}

      {data.exercises.map((exercise) => (
        <Card key={exercise.id}>
          <Text variant="headline" color="accentText">
            {exercise.exerciseName}
          </Text>
          <Text variant="caption" color="textTertiary">
            {muscleGroupLabel[exercise.muscleGroup]}
          </Text>
          {exercise.notes && (
            <Text variant="footnote" color="textSecondary">
              {exercise.notes}
            </Text>
          )}
          <View style={{ gap: space.xs, marginTop: space.xs }}>
            {exercise.sets.map((set, index) => (
              <SetLine
                key={set.id}
                label={setLabel(exercise.sets, index)}
                text={formatSet(set.weight, set.reps, set.weightUnit)}
                record={recordSetIds.has(set.id)}
              />
            ))}
          </View>
        </Card>
      ))}

      <Button title="Repeat this workout" icon="repeat" onPress={() => repeat(id)} />
      <Button title="Delete workout" variant="danger" icon="trash-outline" onPress={confirmDelete} loading={remove.isPending} />
      <Text variant="caption" color="textTertiary" align="center">
        Weights shown in the unit they were logged ({[...new Set(data.exercises.flatMap((e) => e.sets.map((s) => unitLabel(s.weightUnit))))].join(', ') || unitLabel(unit)}).
      </Text>
    </ScrollView>
  );
}

function SetLine({ label, text, record }: { label: string; text: string; record: boolean }) {
  const { colors } = useTheme();
  const warmup = label === 'W';
  return (
    <View style={styles.setLine}>
      <View style={[styles.setBadge, { backgroundColor: warmup ? colors.surfaceRaised : colors.accentMuted }]}>
        <Text variant="caption" color={warmup ? 'textSecondary' : 'accentText'}>
          {label}
        </Text>
      </View>
      <Text variant="number">{text}</Text>
      {record && (
        <View style={styles.prBadge} accessible accessibilityLabel="Personal record">
          <Icon name="trophy" size={14} color="gold" />
          <Text variant="caption" color="textSecondary">
            PR
          </Text>
        </View>
      )}
    </View>
  );
}

/** "W" for warm-ups, "D"/"F" for drop/failure sets, otherwise the working-set number. */
function setLabel(sets: Workout['exercises'][number]['sets'], index: number): string {
  const type = sets[index].setType;
  if (type === 'WARMUP') return 'W';
  if (type === 'DROP') return 'D';
  if (type === 'FAILURE') return 'F';
  return String(sets.slice(0, index + 1).filter((s) => s.setType === 'WORKING').length);
}

function summarize(workout: Workout) {
  const counted = workout.exercises.flatMap((e) => e.sets).filter((s) => s.setType !== 'WARMUP');
  const volumeKg = counted.reduce((sum, s) => sum + (s.weightUnit === 'LB' ? s.weight * KG_PER_LB : s.weight) * s.reps, 0);
  return { sets: counted.length, volumeKg };
}

const styles = StyleSheet.create({
  content: { padding: space.lg, gap: space.md, paddingBottom: space.xxxl },
  stats: { flexDirection: 'row', gap: space.sm },
  setLine: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  setBadge: { width: 28, height: 24, borderRadius: radius.sm, alignItems: 'center', justifyContent: 'center' },
  prBadge: { flexDirection: 'row', alignItems: 'center', gap: 2 },
});
