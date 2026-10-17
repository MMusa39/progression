/**
 * Workout tab: start or resume a workout, start one of your routines, and
 * repeat recent workouts with one tap.
 */
import { useQueryClient } from '@tanstack/react-query';
import { router } from 'expo-router';
import { RefreshControl, ScrollView, StyleSheet, View } from 'react-native';

import { Button, Card, Icon, Text } from '@/components/ui';
import { useMe, useWorkoutHistory } from '@/features/api/queries';
import type { Routine } from '@/features/api/types';
import { useRoutines } from '@/features/routines/queries';
import { useActiveWorkout, workoutProgress } from '@/features/workout/activeWorkoutStore';
import { ElapsedTimer } from '@/features/workout/components/ElapsedTimer';
import { WorkoutSummaryCard } from '@/features/workout/components/WorkoutSummaryCard';
import { formatWorkoutDate } from '@/features/workout/format';
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
  const { startEmpty, repeat, startRoutine } = useStartWorkout();
  const routines = useRoutines();

  const recent = history.data?.pages[0]?.items.slice(0, 3) ?? [];
  const firstName = me.data?.displayName?.split(' ')[0];

  return (
    <ScrollView
      contentInsetAdjustmentBehavior="automatic"
      contentContainerStyle={styles.content}
      refreshControl={
        <RefreshControl
          refreshing={history.isRefetching}
          onRefresh={() => {
            void history.refetch();
            void routines.refetch();
          }}
        />
      }>
      <Text variant="callout" color="textSecondary">
        {greeting()}
        {firstName ? `, ${firstName}` : ''}. Ready to lift?
      </Text>

      {active ? (
        <Card onPress={() => router.push('/workout')} style={[styles.activeCard, { borderColor: colors.accent }]} accessibilityLabel="Resume workout">
          <View style={styles.row}>
            <View style={[styles.liveDot, { backgroundColor: colors.accent }]} />
            <Text variant="caption" color="accentText">
              {active.editing ? 'EDITING' : 'IN PROGRESS'}
            </Text>
          </View>
          <Text variant="title2">{active.name}</Text>
          <View style={styles.row}>
            {active.editing ? (
              <Text variant="subhead" color="textSecondary">
                From {formatWorkoutDate(active.startedAt)} · {workoutProgress(active).completed} sets
              </Text>
            ) : (
              <>
                <ElapsedTimer since={active.startedAt} variant="number" color="textSecondary" />
                <Text variant="subhead" color="textSecondary">
                  · {workoutProgress(active).completed} sets done
                </Text>
              </>
            )}
          </View>
          <Button
            title={active.editing ? 'Continue editing' : 'Resume workout'}
            icon={active.editing ? 'create-outline' : 'play'}
            onPress={() => router.push('/workout')}
            style={{ marginTop: space.sm }}
          />
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

      {routines.data && (
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text variant="title2">Routines</Text>
            {routines.data.length > 0 && (
              <Button
                title="New"
                icon="add"
                variant="ghost"
                size="sm"
                fullWidth={false}
                onPress={() => router.push({ pathname: '/routine/[id]', params: { id: 'new' } })}
              />
            )}
          </View>
          {routines.data.length === 0 ? (
            <Card onPress={() => router.push({ pathname: '/routine/[id]', params: { id: 'new' } })} style={styles.row} accessibilityLabel="Create a routine">
              <Icon name="list" size={22} color="accentText" />
              <View style={{ flex: 1 }}>
                <Text variant="headline">Create a routine</Text>
                <Text variant="footnote" color="textSecondary">
                  Save your usual workouts with sets and rep ranges. Start them in one tap and get told when to add weight.
                </Text>
              </View>
              <Icon name="chevron-forward" size={16} color="textTertiary" />
            </Card>
          ) : (
            routines.data.map((routine) => <RoutineCard key={routine.id} routine={routine} onStart={() => startRoutine(routine)} />)
          )}
        </View>
      )}

      {recent.length > 0 && (
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text variant="title2">Recent</Text>
            <Button title="See all" variant="ghost" size="sm" fullWidth={false} onPress={() => router.push('/history')} />
          </View>
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

function RoutineCard({ routine, onStart }: { routine: Routine; onStart: () => void }) {
  const names = routine.exercises.map((e) => e.exerciseName);
  const summary = names.slice(0, 3).join(', ') + (names.length > 3 ? ` +${names.length - 3}` : '');
  return (
    <Card
      onPress={() => router.push({ pathname: '/routine/[id]', params: { id: routine.id } })}
      style={styles.row}
      accessibilityLabel={`${routine.name}: ${names.join(', ')}. Tap to edit.`}>
      <View style={{ flex: 1, gap: 2 }}>
        <Text variant="headline">{routine.name}</Text>
        <Text variant="footnote" color="textSecondary" numberOfLines={2}>
          {summary}
        </Text>
      </View>
      <Button title="Start" icon="play" size="sm" fullWidth={false} onPress={onStart} />
    </Card>
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
  sectionHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
});
