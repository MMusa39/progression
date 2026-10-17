import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';

import { Card, Icon, Text } from '@/components/ui';
import type { WorkoutSummary } from '@/features/api/types';
import { space } from '@/theme/tokens';

import { formatDuration, formatWorkoutDate } from '../format';

/** History list item: date, name, headline stats and a preview of the exercises. */
export function WorkoutSummaryCard({
  workout,
  onPress,
  action,
}: {
  workout: WorkoutSummary;
  onPress: () => void;
  /** Optional trailing button (e.g. "Repeat"), laid out beside the exercise preview. */
  action?: ReactNode;
}) {
  const duration = formatDuration(workout.startedAt, workout.endedAt);
  const preview =
    workout.exerciseNames.slice(0, 3).join(' · ') +
    (workout.exerciseNames.length > 3 ? ` +${workout.exerciseNames.length - 3} more` : '');

  return (
    <Card onPress={onPress} accessibilityLabel={`${workout.name}, ${formatWorkoutDate(workout.startedAt)}`}>
      <View style={styles.header}>
        <Text variant="caption" color="accentText">
          {formatWorkoutDate(workout.startedAt).toUpperCase()}
        </Text>
        <Icon name="chevron-forward" size={16} color="textTertiary" />
      </View>
      <Text variant="headline">{workout.name}</Text>
      <View style={styles.stats}>
        {duration && <Stat icon="time-outline" text={duration} />}
        <Stat icon="barbell-outline" text={`${workout.exerciseNames.length} exercise${workout.exerciseNames.length === 1 ? '' : 's'}`} />
        <Stat icon="layers-outline" text={`${workout.setCount} sets`} />
      </View>
      {(preview || action) && (
        <View style={styles.footer}>
          <Text variant="footnote" color="textSecondary" numberOfLines={1} style={styles.preview}>
            {preview}
          </Text>
          {action}
        </View>
      )}
    </Card>
  );
}

function Stat({ icon, text }: { icon: 'time-outline' | 'layers-outline' | 'barbell-outline'; text: string }) {
  return (
    <View style={styles.stat}>
      <Icon name={icon} size={14} color="textSecondary" />
      <Text variant="footnote" color="textSecondary">
        {text}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  stats: { flexDirection: 'row', gap: space.lg, flexWrap: 'wrap' },
  stat: { flexDirection: 'row', alignItems: 'center', gap: space.xs },
  footer: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  preview: { flex: 1 },
});
