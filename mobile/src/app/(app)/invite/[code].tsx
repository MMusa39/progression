/**
 * Opened from a friend's invite link (progression://invite/CODE). Shows whose
 * invite it is and connects you with one tap.
 */
import { router, useLocalSearchParams } from 'expo-router';
import { ActivityIndicator, StyleSheet, View } from 'react-native';

import { Button, EmptyState, Screen, Text } from '@/components/ui';
import { useFriendAction, useInvitePreview, useMe } from '@/features/api/queries';
import { Avatar } from '@/features/friends/Avatar';
import { handle, personName } from '@/features/friends/names';
import { UsernameForm } from '@/features/friends/UsernameForm';
import { space } from '@/theme/tokens';

export default function InviteScreen() {
  const { code } = useLocalSearchParams<{ code: string }>();
  const preview = useInvitePreview(code);
  const me = useMe();
  const action = useFriendAction();

  if (preview.isPending || me.isPending) return <ActivityIndicator style={{ flex: 1 }} />;
  if (preview.isError) {
    return (
      <EmptyState
        icon="link-outline"
        title="Invite not found"
        message={preview.error.message}
        action={<Button title="Close" variant="secondary" fullWidth={false} onPress={() => router.back()} />}
      />
    );
  }

  const { user, relationship } = preview.data;
  const own = user.id === me.data?.id;
  const friends = relationship === 'FRIENDS';

  return (
    <Screen
      footer={
        own || friends ? (
          <Button title="Done" onPress={() => router.back()} />
        ) : me.data?.username ? (
          <Button
            title={`Add ${personName(user)}`}
            icon="person-add-outline"
            loading={action.isPending}
            onPress={() => action.mutate({ type: 'useInvite', code }, { onSuccess: () => router.replace(`/friends/${user.id}`) })}
          />
        ) : null
      }>
      <View style={styles.hero}>
        <Avatar user={user} size={88} />
        <Text variant="title" align="center">
          {own ? 'This is your invite' : personName(user)}
        </Text>
        {handle(user) && (
          <Text variant="callout" color="textSecondary">
            {handle(user)}
          </Text>
        )}
        <Text variant="callout" color="textSecondary" align="center">
          {own
            ? 'Share this link with friends so they can add you.'
            : friends
              ? "You're already friends."
              : 'wants to train with you. You will see each other’s PRs and streaks.'}
        </Text>
        {action.error && (
          <Text variant="footnote" color="danger">
            {action.error.message}
          </Text>
        )}
      </View>
      {!own && !friends && !me.data?.username && (
        <View style={{ gap: space.sm }}>
          <Text variant="subhead" color="textSecondary">
            Pick a username first, so friends can find you.
          </Text>
          <UsernameForm />
        </View>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  hero: { alignItems: 'center', gap: space.md, marginTop: space.xxl },
});
