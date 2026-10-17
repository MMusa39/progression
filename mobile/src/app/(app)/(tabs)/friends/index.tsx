/**
 * Friends tab: requests waiting on you, the two leaderboards, and your friends.
 * Until you've picked a @username, it only asks for that.
 */
import { router, Stack } from 'expo-router';
import { ActivityIndicator, Pressable, RefreshControl, ScrollView, StyleSheet, View } from 'react-native';

import { Button, Card, EmptyState, Icon, Text } from '@/components/ui';
import { useConsistencyBoard, useFriendAction, useFriendRequests, useFriends, useMe } from '@/features/api/queries';
import type { Friend, FriendRequest } from '@/features/api/types';
import { Avatar } from '@/features/friends/Avatar';
import { handle, personName } from '@/features/friends/names';
import { UsernameForm } from '@/features/friends/UsernameForm';
import { NotificationPrompt } from '@/features/notifications/NotificationPrompt';
import { shortDate } from '@/features/progress/dates';
import { radius, space } from '@/theme/tokens';
import { useTheme } from '@/theme/useTheme';

export default function FriendsScreen() {
  const me = useMe();
  const friends = useFriends();
  const requests = useFriendRequests();
  const board = useConsistencyBoard();

  if (me.isPending) return <ActivityIndicator style={{ flex: 1 }} />;

  if (!me.data?.username) {
    return (
      <ScrollView contentInsetAdjustmentBehavior="automatic" contentContainerStyle={styles.content}>
        <EmptyState
          icon="people-outline"
          title="Train with friends"
          message="Compare streaks, see each other's PRs, and keep each other consistent. First, pick a username so friends can find you."
        />
        <Card>
          <UsernameForm submitLabel="Continue" />
        </Card>
      </ScrollView>
    );
  }

  const incoming = requests.data?.incoming ?? [];
  const list = friends.data ?? [];
  const winner = board.data?.entries.find((e) => e.winner);

  return (
    <ScrollView
      contentInsetAdjustmentBehavior="automatic"
      contentContainerStyle={styles.content}
      refreshControl={
        <RefreshControl
          refreshing={friends.isRefetching}
          onRefresh={() => {
            friends.refetch();
            requests.refetch();
            board.refetch();
          }}
        />
      }>
      <Stack.Screen
        options={{
          headerRight: () => (
            <Pressable onPress={() => router.push('/friends/add')} hitSlop={10} accessibilityRole="button" accessibilityLabel="Add friends">
              <Icon name="person-add-outline" size={22} color="accentText" />
            </Pressable>
          ),
        }}
      />

      <NotificationPrompt />

      {incoming.length > 0 && <IncomingRequests requests={incoming} />}

      {list.length > 0 && (
        <View style={styles.boards}>
          <BoardCard
            title="Consistency"
            subtitle={winner ? `${winner.you ? 'You lead' : `${personName(winner.user)} leads`} · ${winner.currentStreakWeeks}-wk streak` : 'Streaks & workouts'}
            icon="trophy"
            onPress={() => router.push('/friends/consistency')}
          />
          <BoardCard title="Strength" subtitle="Best lifts, by exercise" icon="barbell" onPress={() => router.push('/friends/strength')} />
        </View>
      )}

      <View style={{ gap: space.sm }}>
        <Text variant="title2">Friends</Text>
        {friends.isPending ? (
          <ActivityIndicator />
        ) : list.length === 0 ? (
          <Card style={styles.emptyCard}>
            <Text variant="callout" color="textSecondary" align="center">
              Add friends to compare streaks and see each other&apos;s PRs. Share your invite link or search by username.
            </Text>
            <Button title="Add friends" icon="person-add-outline" onPress={() => router.push('/friends/add')} />
          </Card>
        ) : (
          <FriendList friends={list} />
        )}
      </View>
    </ScrollView>
  );
}

function IncomingRequests({ requests }: { requests: FriendRequest[] }) {
  const { colors } = useTheme();
  const action = useFriendAction();
  return (
    <View style={{ gap: space.sm }}>
      <Text variant="title2">Requests</Text>
      <View style={[styles.panel, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        {requests.map((request, i) => (
          <View key={request.id} style={[styles.row, i > 0 && { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border }]}>
            <Avatar user={request.user} />
            <View style={{ flex: 1 }}>
              <Text variant="body" weight="600" numberOfLines={1}>
                {personName(request.user)}
              </Text>
              <Text variant="footnote" color="textSecondary">
                {handle(request.user)} wants to be friends
              </Text>
            </View>
            <Button title="Accept" size="sm" fullWidth={false} onPress={() => action.mutate({ type: 'accept', requestId: request.id })} />
            <Pressable
              onPress={() => action.mutate({ type: 'removeRequest', requestId: request.id })}
              hitSlop={8}
              accessibilityRole="button"
              accessibilityLabel={`Decline request from ${personName(request.user)}`}>
              <Icon name="close" size={22} color="textTertiary" />
            </Pressable>
          </View>
        ))}
      </View>
    </View>
  );
}

function BoardCard({ title, subtitle, icon, onPress }: { title: string; subtitle: string; icon: 'trophy' | 'barbell'; onPress: () => void }) {
  return (
    <Card onPress={onPress} style={styles.boardCard} accessibilityLabel={`${title} leaderboard. ${subtitle}`}>
      <Icon name={icon} size={20} color={icon === 'trophy' ? 'gold' : 'accentText'} />
      <Text variant="headline">{title}</Text>
      <Text variant="footnote" color="textSecondary" numberOfLines={2}>
        {subtitle}
      </Text>
    </Card>
  );
}

function FriendList({ friends }: { friends: Friend[] }) {
  const { colors } = useTheme();
  return (
    <View style={[styles.panel, { backgroundColor: colors.surface, borderColor: colors.border }]}>
      {friends.map((friend, i) => (
        <Pressable
          key={friend.user.id}
          onPress={() => router.push(`/friends/${friend.user.id}`)}
          accessibilityRole="button"
          style={({ pressed }) => [
            styles.row,
            i > 0 && { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border },
            pressed && { backgroundColor: colors.surfaceRaised },
          ]}>
          <Avatar user={friend.user} />
          <View style={{ flex: 1, gap: 2 }}>
            <Text variant="body" weight="600" numberOfLines={1}>
              {personName(friend.user)}
            </Text>
            <Text variant="footnote" color="textSecondary" numberOfLines={1}>
              {friend.currentStreakWeeks > 0 ? `${friend.currentStreakWeeks}-week streak` : 'No streak'}
              {friend.lastWorkoutAt ? ` · trained ${shortDate(friend.lastWorkoutAt)}` : ''}
            </Text>
          </View>
          {friend.currentStreakWeeks > 0 && <Icon name="flame" size={18} color="accentText" />}
          <Icon name="chevron-forward" size={16} color="textTertiary" />
        </Pressable>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  content: { padding: space.lg, gap: space.xl, paddingBottom: space.xxxl },
  boards: { flexDirection: 'row', gap: space.sm },
  boardCard: { flex: 1, gap: space.xs },
  panel: { borderRadius: radius.lg, borderWidth: StyleSheet.hairlineWidth, overflow: 'hidden' },
  row: { flexDirection: 'row', alignItems: 'center', gap: space.md, paddingHorizontal: space.lg, paddingVertical: space.md },
  emptyCard: { gap: space.md, padding: space.xl },
});
