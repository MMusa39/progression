/**
 * Read-only view of one workout: date, headline stats, then every exercise and
 * set. Used for your own history (with personal-record badges and actions) and
 * for a friend's workout.
 */
import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';

import { Card, Icon, StatTile, Text } from '@/components/ui';
import type { Workout } from '@/features/api/types';
import { radius, space } from '@/theme/tokens';
import { useTheme } from '@/theme/useTheme';

import { formatDuration, formatSet, muscleGroupLabel } from '../format';

type WorkoutDetailProps = {
  workout: Workout;
  /** Sets that set a personal record get a trophy badge. */
  recordSetIds?: Set<string | null>;
  /** Rendered between the stats and the exercises (e.g. the PR list). */
  header?: ReactNode;
};

export function WorkoutDetail({ workout, recordSetIds, header }: WorkoutDetailProps) {
  const sets = workout.exercises.flatMap((e) => e.sets).filter((s) => s.setType !== 'WARMUP').length;
  return (
    <>
      <Text variant="subhead" color="textSecondary">
        {new Date(workout.startedAt).toLocaleString(undefined, { weekday: 'long', month: 'long', day: 'numeric', hour: 'numeric', minute: '2-digit' })}
      </Text>

      <View style={styles.stats}>
        <StatTile label="Duration" value={formatDuration(workout.startedAt, workout.endedAt) ?? '—'} />
        <StatTile label="Exercises" value={String(workout.exercises.length)} />
        <StatTile label="Sets" value={String(sets)} />
      </View>

      {header}

      {workout.exercises.map((exercise) => (
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
                record={recordSetIds?.has(set.id) ?? false}
              />
            ))}
          </View>
        </Card>
      ))}
    </>
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

const styles = StyleSheet.create({
  stats: { flexDirection: 'row', gap: space.sm },
  setLine: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  setBadge: { width: 28, height: 24, borderRadius: radius.sm, alignItems: 'center', justifyContent: 'center' },
  prBadge: { flexDirection: 'row', alignItems: 'center', gap: 2 },
});
