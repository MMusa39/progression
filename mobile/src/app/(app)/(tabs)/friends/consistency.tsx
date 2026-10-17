/**
 * Consistency leaderboard: ranked by weekly streak, then workouts in the last
 * 4 weeks. The fairest comparison, since anyone can win it by showing up, so
 * the leader gets a crown.
 */
import { Stack, router } from 'expo-router';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { EmptyState, Icon, Text } from '@/components/ui';
import { useConsistencyBoard } from '@/features/api/queries';
import { Avatar } from '@/features/friends/Avatar';
import { personName } from '@/features/friends/names';
import { radius, space } from '@/theme/tokens';
import { useTheme } from '@/theme/useTheme';

export default function ConsistencyBoardScreen() {
  const { colors } = useTheme();
  const board = useConsistencyBoard();

  if (board.isPending) return <ActivityIndicator style={{ flex: 1 }} />;
  if (board.isError) return <EmptyState icon="alert-circle-outline" title="Couldn't load the leaderboard" message={board.error.message} />;

  const entries = board.data.entries;
  const winners = entries.filter((e) => e.winner);

  return (
    <ScrollView contentInsetAdjustmentBehavior="automatic" contentContainerStyle={styles.content}>
      <Stack.Screen options={{ title: 'Consistency' }} />
      <Text variant="subhead" color="textSecondary">
        Ranked by weekly streak, then workouts in the last 4 weeks. Show up every week to take the crown.
      </Text>

      {winners.length > 0 && (
        <View style={[styles.winner, { backgroundColor: colors.surface, borderColor: colors.gold }]} accessible accessibilityLabel={`Leader: ${winners.map((w) => (w.you ? 'you' : personName(w.user))).join(' and ')}`}>
          <Icon name="trophy" size={28} color="gold" />
          <View style={{ flex: 1 }}>
            <Text variant="caption" color="textSecondary">
              {winners.length > 1 ? 'TIED FOR THE LEAD' : 'LEADER'}
            </Text>
            <Text variant="title2" numberOfLines={1}>
              {winners.map((w) => (w.you ? 'You' : personName(w.user))).join(' & ')}
            </Text>
            <Text variant="footnote" color="textSecondary">
              {winners[0].currentStreakWeeks}-week streak · {winners[0].workoutsLast4Weeks} workouts in 4 weeks
            </Text>
          </View>
        </View>
      )}

      <View style={[styles.panel, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        {entries.map((entry, i) => (
          <Pressable
            key={entry.user.id}
            disabled={entry.you}
            onPress={() => router.push(`/friends/${entry.user.id}`)}
            accessibilityRole={entry.you ? undefined : 'button'}
            accessibilityLabel={`Rank ${entry.rank}: ${entry.you ? 'you' : personName(entry.user)}, ${entry.currentStreakWeeks}-week streak, ${entry.workoutsLast4Weeks} workouts in the last 4 weeks`}
            style={[
              styles.row,
              i > 0 && { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border },
              entry.you && { backgroundColor: colors.accentMuted },
            ]}>
            <Text variant="headline" color="textSecondary" style={styles.rank}>
              {entry.rank}
            </Text>
            <Avatar user={entry.user} size={36} you={entry.you} />
            <View style={{ flex: 1 }}>
              <Text variant="body" weight="600" numberOfLines={1}>
                {entry.you ? 'You' : personName(entry.user)}
              </Text>
              <Text variant="footnote" color="textSecondary">
                {entry.workoutsLast4Weeks} workout{entry.workoutsLast4Weeks === 1 ? '' : 's'} in 4 weeks
              </Text>
            </View>
            {entry.winner && <Icon name="trophy" size={16} color="gold" />}
            <View style={styles.streak}>
              <Text variant="headline">{entry.currentStreakWeeks}</Text>
              <Text variant="caption" color="textTertiary">
                wk streak
              </Text>
            </View>
          </Pressable>
        ))}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { padding: space.lg, gap: space.lg, paddingBottom: space.xxxl },
  winner: { flexDirection: 'row', alignItems: 'center', gap: space.lg, padding: space.lg, borderRadius: radius.lg, borderWidth: 1.5 },
  panel: { borderRadius: radius.lg, borderWidth: StyleSheet.hairlineWidth, overflow: 'hidden' },
  row: { flexDirection: 'row', alignItems: 'center', gap: space.md, paddingHorizontal: space.lg, paddingVertical: space.md },
  rank: { width: 22, textAlign: 'center' },
  streak: { alignItems: 'flex-end', minWidth: 56 },
});
