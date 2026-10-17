/**
 * A friend's page: their streak, recent personal records, and (if they share
 * them) their workouts.
 */
import { Stack, router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { EmptyState, Icon, StatTile, Text } from '@/components/ui';
import { useFriend, useFriendAction, useFriendRecords, useFriendWorkouts } from '@/features/api/queries';
import { Avatar } from '@/features/friends/Avatar';
import { handle, personName } from '@/features/friends/names';
import { shortDate } from '@/features/progress/dates';
import { formatWeight, unitLabel } from '@/features/workout/format';
import { WorkoutSummaryCard } from '@/features/workout/components/WorkoutSummaryCard';
import { radius, space } from '@/theme/tokens';
import { useTheme } from '@/theme/useTheme';

const RECORDS_WINDOW_DAYS = 90;

export default function FriendScreen() {
  const { colors } = useTheme();
  const { friendId } = useLocalSearchParams<{ friendId: string }>();
  const friend = useFriend(friendId);
  // Computed once per visit; a stable value keeps the query key stable.
  const [since] = useState(() => new Date(Date.now() - RECORDS_WINDOW_DAYS * 86_400_000));
  const records = useFriendRecords(friendId, since);
  const shares = friend.data?.shareWorkouts ?? false;
  const workouts = useFriendWorkouts(friendId, shares);
  const action = useFriendAction();

  if (friend.isPending) return <ActivityIndicator style={{ flex: 1 }} />;
  if (friend.isError) return <EmptyState icon="person-outline" title="Friend not found" message={friend.error.message} />;

  const f = friend.data;
  const name = personName(f.user);
  const confirmRemove = () =>
    Alert.alert(`Remove ${name}?`, "You'll stop seeing each other's training. You can add each other again later.", [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Remove friend',
        style: 'destructive',
        onPress: () => action.mutate({ type: 'unfriend', friendId }, { onSuccess: () => router.back() }),
      },
    ]);

  // One row per lift per session, newest first.
  const recordGroups = [...new Map((records.data ?? []).map((r) => [`${r.workoutId}-${r.exerciseId}`, r])).values()].slice(0, 5);
  const items = workouts.data?.pages.flatMap((p) => p.items) ?? [];

  return (
    <ScrollView contentInsetAdjustmentBehavior="automatic" contentContainerStyle={styles.content}>
      <Stack.Screen
        options={{
          title: name,
          headerRight: () => (
            <Pressable onPress={confirmRemove} hitSlop={10} accessibilityRole="button" accessibilityLabel="Friend options">
              <Icon name="ellipsis-horizontal-circle-outline" size={24} color="accentText" />
            </Pressable>
          ),
        }}
      />

      <View style={styles.header}>
        <Avatar user={f.user} size={64} />
        <View style={{ flex: 1, gap: 2 }}>
          <Text variant="title2">{name}</Text>
          <Text variant="subhead" color="textSecondary">
            {handle(f.user)} · friends since {shortDate(f.friendsSince)}
          </Text>
        </View>
      </View>

      <View style={styles.stats}>
        <StatTile label="Week streak" value={f.currentStreakWeeks > 0 ? `${f.currentStreakWeeks}` : '—'} />
        <StatTile label="Last 4 weeks" value={`${f.workoutsLast4Weeks} workouts`} />
      </View>

      <View style={{ gap: space.sm }}>
        <Text variant="title2">Recent PRs</Text>
        {recordGroups.length === 0 ? (
          <Text variant="subhead" color="textSecondary">
            No personal records in the last {RECORDS_WINDOW_DAYS} days.
          </Text>
        ) : (
          <View style={[styles.panel, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            {recordGroups.map((r, i) => (
              <View key={`${r.workoutId}-${r.exerciseId}`} style={[styles.row, i > 0 && { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border }]}>
                <Icon name="trophy" size={16} color="gold" />
                <View style={{ flex: 1 }}>
                  <Text variant="subhead" weight="600">
                    {r.exerciseName}
                  </Text>
                  <Text variant="footnote" color="textSecondary">
                    {formatWeight(r.weight)} {unitLabel(r.weightUnit)} × {r.reps}
                  </Text>
                </View>
                <Text variant="caption" color="textTertiary">
                  {shortDate(r.achievedAt)}
                </Text>
              </View>
            ))}
          </View>
        )}
      </View>

      <View style={{ gap: space.sm }}>
        <Text variant="title2">Workouts</Text>
        {!shares ? (
          <View style={[styles.notice, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <Icon name="lock-closed-outline" size={18} color="textTertiary" />
            <Text variant="subhead" color="textSecondary" style={{ flex: 1 }}>
              {name} shares personal records only, not individual workouts.
            </Text>
          </View>
        ) : workouts.isPending ? (
          <ActivityIndicator />
        ) : items.length === 0 ? (
          <Text variant="subhead" color="textSecondary">
            No workouts yet.
          </Text>
        ) : (
          <>
            {items.map((w) => (
              <WorkoutSummaryCard key={w.id} workout={w} onPress={() => router.push(`/friends/${friendId}/${w.id}`)} />
            ))}
            {workouts.hasNextPage && (
              <Pressable onPress={() => workouts.fetchNextPage()} style={styles.more} accessibilityRole="button">
                <Text variant="footnote" weight="600" color="accentText">
                  {workouts.isFetchingNextPage ? 'Loading…' : 'Show more'}
                </Text>
              </Pressable>
            )}
          </>
        )}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { padding: space.lg, gap: space.xl, paddingBottom: space.xxxl },
  header: { flexDirection: 'row', alignItems: 'center', gap: space.lg },
  stats: { flexDirection: 'row', gap: space.sm },
  panel: { borderRadius: radius.lg, borderWidth: StyleSheet.hairlineWidth, overflow: 'hidden' },
  row: { flexDirection: 'row', alignItems: 'center', gap: space.md, paddingHorizontal: space.lg, paddingVertical: space.md },
  notice: { flexDirection: 'row', alignItems: 'center', gap: space.md, padding: space.lg, borderRadius: radius.lg, borderWidth: StyleSheet.hairlineWidth },
  more: { alignSelf: 'center', padding: space.md },
});
