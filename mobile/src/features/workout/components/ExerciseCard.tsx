/**
 * One exercise inside the active workout: header, the set table, and an
 * "Add set" button. Fetches this exercise's last performance to drive the
 * PREVIOUS column, the overload hint ("Today: 190 lb × 6") and the
 * greyed-out suggestions, which follow the hint so ticking a set logs it.
 */
import * as Haptics from 'expo-haptics';
import { Alert, Pressable, StyleSheet, View } from 'react-native';

import { Button, Card, Icon, Text } from '@/components/ui';
import { useLastPerformance } from '@/features/api/queries';
import type { WeightUnit } from '@/features/api/types';
import { space } from '@/theme/tokens';

import { useActiveWorkout, type DraftExercise, type DraftSet } from '../activeWorkoutStore';
import { useRestTimer } from '../restTimer';
import { formatSet, formatWeight, muscleGroupLabel, unitLabel } from '../format';
import { formatHint, overloadHint } from '../overload';
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
  const editing = useActiveWorkout((s) => Boolean(s.active?.editing));
  const { updateSet, toggleComplete, removeSet, addSet, removeExercise, moveExercise } = useActiveWorkout.getState();

  const previousSets = lastPerformance?.sets ?? [];
  // No hints when fixing up a past workout: that's about recording, not progressing.
  const hint = !editing && previousSets.length > 0 ? overloadHint(previousSets, item.exercise.equipment, item.target) : null;
  const tableUnit = item.sets[0]?.weightUnit ?? unit;

  const openMenu = () =>
    Alert.alert(item.exercise.name, undefined, [
      ...(index > 0 ? [{ text: 'Move up', onPress: () => moveExercise(item.id, -1) }] : []),
      ...(index < count - 1 ? [{ text: 'Move down', onPress: () => moveExercise(item.id, 1) }] : []),
      { text: 'Remove exercise', style: 'destructive' as const, onPress: () => removeExercise(item.id) },
      { text: 'Cancel', style: 'cancel' as const },
    ]);

  /**
   * Greyed-out suggestion for set `i`: the overload hint for working sets,
   * otherwise the same set last session if there was one, otherwise whatever
   * the set above has (typed or suggested), otherwise the routine's rep target.
   */
  const suggestions: (Suggestion | null)[] = [];
  item.sets.forEach((set, i) => {
    if (hint && set.setType === 'WORKING') {
      suggestions.push({ weight: formatWeight(hint.weight), reps: String(hint.reps) });
      return;
    }
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
    suggestions.push(item.target ? { weight: '', reps: String(item.target.repMin) } : null);
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
            {item.target &&
              ` · ${item.target.sets} × ${item.target.repMin === item.target.repMax ? item.target.repMin : `${item.target.repMin}–${item.target.repMax}`} reps`}
          </Text>
        </View>
        <Pressable onPress={openMenu} hitSlop={12} accessibilityRole="button" accessibilityLabel={`${item.exercise.name} options`}>
          <Icon name="ellipsis-horizontal" size={22} color="textSecondary" />
        </Pressable>
      </View>

      {hint && (
        <View style={styles.hint} accessible accessibilityLabel={`Suggestion for today: ${formatHint(hint)}. ${hint.reason}.`}>
          <Icon name={hint.kind === 'add-weight' ? 'trending-up' : 'add-circle-outline'} size={16} color="accentText" />
          <Text variant="footnote" style={{ flex: 1 }}>
            <Text variant="footnote" weight="700" color="accentText">
              Today: {formatHint(hint)}
            </Text>
            <Text variant="footnote" color="textSecondary">
              {'  '}
              {hint.reason}
            </Text>
          </Text>
        </View>
      )}
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
              const wasDone = set.completedAt !== null;
              const ok = toggleComplete(item.id, set.id, suggestions[i] ?? undefined);
              // No rest timer when fixing up a past workout.
              if (ok && !wasDone && !useActiveWorkout.getState().active?.editing) useRestTimer.getState().startDefault();
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
  hint: { flexDirection: 'row', alignItems: 'center', gap: space.xs + 2 },
});
