/**
 * One exercise inside the active workout: header, the set table, and an
 * "Add set" button. Fetches this exercise's last performance to drive the
 * PREVIOUS column and the greyed-out suggestions.
 */
import * as Haptics from 'expo-haptics';
import { Alert, Pressable, StyleSheet, View } from 'react-native';

import { Button, Card, Icon, Text } from '@/components/ui';
import { useLastPerformance } from '@/features/api/queries';
import type { WeightUnit } from '@/features/api/types';
import { space } from '@/theme/tokens';

import { useActiveWorkout, type DraftExercise, type DraftSet } from '../activeWorkoutStore';
import { formatSet, formatWeight, muscleGroupLabel, unitLabel } from '../format';
import { SetRow, SetTableHeader, type Suggestion } from './SetRow';

type ExerciseCardProps = {
  workoutId: string;
  item: DraftExercise;
  index: number;
  count: number;
  unit: WeightUnit;
};

export function ExerciseCard({ workoutId, item, index, count, unit }: ExerciseCardProps) {
  const lastPerformance = useLastPerformance(item.exercise.id, workoutId).data ?? null;
  const { updateSet, toggleComplete, removeSet, addSet, removeExercise, moveExercise } = useActiveWorkout.getState();

  const previousSets = lastPerformance?.sets ?? [];
  const tableUnit = item.sets[0]?.weightUnit ?? unit;

  const openMenu = () =>
    Alert.alert(item.exercise.name, undefined, [
      ...(index > 0 ? [{ text: 'Move up', onPress: () => moveExercise(item.id, -1) }] : []),
      ...(index < count - 1 ? [{ text: 'Move down', onPress: () => moveExercise(item.id, 1) }] : []),
      { text: 'Remove exercise', style: 'destructive' as const, onPress: () => removeExercise(item.id) },
      { text: 'Cancel', style: 'cancel' as const },
    ]);

  /**
   * Greyed-out suggestion for set `i`: same set last session if there was one,
   * otherwise whatever the set above has (typed or suggested).
   */
  const suggestions: (Suggestion | null)[] = [];
  item.sets.forEach((set, i) => {
    const previous = previousSets[i];
    if (previous) {
      suggestions.push({ weight: formatWeight(previous.weight), reps: String(previous.reps) });
      return;
    }
    const above = item.sets[i - 1];
    const aboveSuggestion = suggestions[i - 1];
    if (above && (above.weight || above.reps || aboveSuggestion)) {
      suggestions.push({ weight: above.weight || aboveSuggestion?.weight || '', reps: above.reps || aboveSuggestion?.reps || '' });
      return;
    }
    suggestions.push(null);
  });

  return (
    <Card style={styles.card}>
      <View style={styles.header}>
        <View style={{ flex: 1 }}>
          <Text variant="headline" color="accentText">
            {item.exercise.name}
          </Text>
          <Text variant="caption" color="textTertiary">
            {muscleGroupLabel[item.exercise.muscleGroup]}
          </Text>
        </View>
        <Pressable onPress={openMenu} hitSlop={12} accessibilityRole="button" accessibilityLabel={`${item.exercise.name} options`}>
          <Icon name="ellipsis-horizontal" size={22} color="textSecondary" />
        </Pressable>
      </View>

      <SetTableHeader unitLabel={unitLabel(tableUnit)} />
      {item.sets.map((set, i) => {
        const previous = previousSets[i];
        return (
          <SetRow
            key={set.id}
            set={set}
            label={setLabel(item.sets, i)}
            previous={previous ? formatSet(previous.weight, previous.reps) : null}
            suggestion={suggestions[i]}
            onChange={(patch) => updateSet(item.id, set.id, patch)}
            onRemove={() => removeSet(item.id, set.id)}
            onToggleComplete={() => {
              const ok = toggleComplete(item.id, set.id, suggestions[i] ?? undefined);
              if (!ok) {
                Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
                Alert.alert('Enter weight and reps', 'Fill in how much you lifted and for how many reps, then tick the set.');
              }
            }}
          />
        );
      })}

      <Button title="Add set" icon="add" variant="secondary" size="sm" onPress={() => addSet(item.id)} />
    </Card>
  );
}

function setLabel(sets: DraftSet[], index: number): string {
  const type = sets[index].setType;
  if (type === 'WARMUP') return 'W';
  if (type === 'DROP') return 'D';
  if (type === 'FAILURE') return 'F';
  return String(sets.slice(0, index + 1).filter((s) => s.setType === 'WORKING').length);
}

const styles = StyleSheet.create({
  card: { gap: space.sm, paddingHorizontal: space.md },
  header: { flexDirection: 'row', alignItems: 'flex-start', gap: space.sm },
});
