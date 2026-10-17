/**
 * Workout tab: start or resume a workout, and repeat recent ones with one tap.
 */
import { useQueryClient } from '@tanstack/react-query';
import { router } from 'expo-router';
import { RefreshControl, ScrollView, StyleSheet, View } from 'react-native';

import { Button, Card, Icon, Text } from '@/components/ui';
import { useMe, useWorkoutHistory } from '@/features/api/queries';
import { useActiveWorkout, workoutProgress } from '@/features/workout/activeWorkoutStore';
import { ElapsedTimer } from '@/features/workout/components/ElapsedTimer';
import { WorkoutSummaryCard } from '@/features/workout/components/WorkoutSummaryCard';
import { useStartWorkout } from '@/features/workout/useStartWorkout';
import { useWorkoutSync } from '@/features/workout/workoutSync';
import { radius, space } from '@/theme/tokens';
import { useTheme } from '@/theme/useTheme';

export default function WorkoutHomeScreen() {
  const { colors } = useTheme();
  const queryClient = useQueryClient();
  const active = useActiveWorkout((s) => s.active);
  const { pending, syncing, flush } = useWorkoutSync();
  const history = useWorkoutHistory();
  const me = useMe();
  const { startEmpty, repeat } = useStartWorkout();

  const recent = history.data?.pages[0]?.items.slice(0, 3) ?? [];
  const firstName = me.data?.displayName?.split(' ')[0];

  return (
    <ScrollView
      contentInsetAdjustmentBehavior="automatic"
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={history.isRefetching} onRefresh={() => void history.refetch()} />}>
      <Text variant="callout" color="textSecondary">
        {greeting()}
        {firstName ? `, ${firstName}` : ''}. Ready to lift?
      </Text>

      {active ? (
        <Card onPress={() => router.push('/workout')} style={[styles.activeCard, { borderColor: colors.accent }]} accessibilityLabel="Resume workout">
          <View style={styles.row}>
            <View style={[styles.liveDot, { backgroundColor: colors.accent }]} />
            <Text variant="caption" color="accentText">
              IN PROGRESS
            </Text>
          </View>
          <Text variant="title2">{active.name}</Text>
          <View style={styles.row}>
            <ElapsedTimer since={active.startedAt} variant="number" color="textSecondary" />
            <Text variant="subhead" color="textSecondary">
              · {workoutProgress(active).completed} sets done
            </Text>
          </View>
          <Button title="Resume workout" icon="play" onPress={() => router.push('/workout')} style={{ marginTop: space.sm }} />
        </Card>
      ) : (
        <Card style={styles.startCard}>
          <View style={[styles.startIcon, { backgroundColor: colors.accentMuted }]}>
            <Icon name="barbell" size={28} color="accentText" />
          </View>
          <Text variant="title2">Start a workout</Text>
          <Text variant="subhead" color="textSecondary">
            Add exercises as you go. Your last session’s numbers show up as you log each set.
          </Text>
          <Button title="Start empty workout" icon="add" onPress={startEmpty} style={{ marginTop: space.sm }} />
        </Card>
      )}

      {pending.length > 0 && (
        <Card style={styles.row}>
          <Icon name="cloud-upload-outline" size={20} color="textSecondary" />
          <Text variant="subhead" color="textSecondary" style={{ flex: 1 }}>
            {pending.length} workout{pending.length > 1 ? 's' : ''} waiting to sync
          </Text>
          <Button title={syncing ? 'Syncing' : 'Retry'} size="sm" variant="secondary" fullWidth={false} loading={syncing} onPress={() => flush(queryClient)} />
        </Card>
      )}

      {recent.length > 0 && (
        <View style={styles.section}>
          <Text variant="title2">Recent</Text>
          {recent.map((workout) => (
            <WorkoutSummaryCard
              key={workout.id}
              workout={workout}
              onPress={() => router.push(`/history/${workout.id}`)}
              action={<Button title="Repeat" icon="repeat" size="sm" variant="secondary" fullWidth={false} onPress={() => repeat(workout.id)} />}
            />
          ))}
        </View>
      )}
    </ScrollView>
  );
}

function greeting() {
  const hour = new Date().getHours();
  if (hour < 12) return 'Good morning';
  if (hour < 18) return 'Good afternoon';
  return 'Good evening';
}

const styles = StyleSheet.create({
  content: { padding: space.lg, gap: space.lg, paddingBottom: space.xxxl },
  row: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  activeCard: { borderWidth: 1.5, gap: space.sm },
  liveDot: { width: 8, height: 8, borderRadius: radius.pill },
  startCard: { gap: space.sm, padding: space.xl },
  startIcon: { width: 52, height: 52, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center' },
  section: { gap: space.md, marginTop: space.sm },
});
