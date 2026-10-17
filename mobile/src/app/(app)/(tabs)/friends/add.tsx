/**
 * Add friends: search by @username, share your invite link, or enter a
 * friend's invite code. Also lists requests you've sent.
 */
import * as Linking from 'expo-linking';
import { Stack } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, Alert, Pressable, ScrollView, Share, StyleSheet, TextInput, View } from 'react-native';

import { Button, Card, Icon, Text } from '@/components/ui';
import { useFriendAction, useFriendRequests, useInvite, useUserSearch } from '@/features/api/queries';
import type { Relationship, UserSearchResult } from '@/features/api/types';
import { Avatar } from '@/features/friends/Avatar';
import { handle, personName } from '@/features/friends/names';
import { hitTarget, radius, space, typography } from '@/theme/tokens';
import { useTheme } from '@/theme/useTheme';

export default function AddFriendsScreen() {
  const { colors } = useTheme();
  const [query, setQuery] = useState('');
  const search = useUserSearch(query);
  const invite = useInvite();
  const requests = useFriendRequests();
  const action = useFriendAction();
  const [code, setCode] = useState('');

  const shareInvite = async () => {
    if (!invite.data) return;
    // createURL builds the right link for the environment: exp://… in Expo Go, progression://… in builds.
    const url = Linking.createURL(`invite/${invite.data.code}`);
    await Share.share({ message: `Train with me on Progression: ${url}\n\nOr enter my invite code: ${invite.data.code}` });
  };

  const useCode = () =>
    action.mutate(
      { type: 'useInvite', code },
      {
        onSuccess: (result) => {
          setCode('');
          if (result && 'user' in result) Alert.alert('Friends!', `You and ${personName(result.user)} are now friends.`);
        },
        onError: (e) => Alert.alert("Couldn't use that code", e.message),
      },
    );

  return (
    <ScrollView contentInsetAdjustmentBehavior="automatic" contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
      <Stack.Screen options={{ title: 'Add Friends' }} />

      <View style={[styles.search, { backgroundColor: colors.surfaceRaised }]}>
        <Icon name="search" size={18} color="textTertiary" />
        <TextInput
          value={query}
          onChangeText={setQuery}
          placeholder="Search by username"
          placeholderTextColor={colors.textTertiary}
          autoCapitalize="none"
          autoCorrect={false}
          autoFocus
          returnKeyType="search"
          style={[typography.body, styles.searchInput, { color: colors.text }]}
          accessibilityLabel="Search by username"
        />
      </View>

      {query.trim().replace('@', '').length >= 2 && (
        <View style={[styles.panel, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          {search.isPending ? (
            <ActivityIndicator style={{ padding: space.lg }} />
          ) : (search.data ?? []).length === 0 ? (
            <Text variant="subhead" color="textSecondary" style={{ padding: space.lg }}>
              No one with a username starting with &quot;{query.trim()}&quot;.
            </Text>
          ) : (
            search.data!.map((result, i) => <SearchRow key={result.user.id} result={result} first={i === 0} />)
          )}
        </View>
      )}

      <Card>
        <Text variant="headline">Invite a friend</Text>
        <Text variant="footnote" color="textSecondary">
          Anyone who opens your link becomes your friend right away, with no request needed.
        </Text>
        {invite.data && (
          <Text variant="title2" style={styles.code} accessibilityLabel={`Your invite code: ${invite.data.code.split('').join(' ')}`}>
            {invite.data.code}
          </Text>
        )}
        <Button title="Share invite link" icon="share-outline" onPress={shareInvite} disabled={!invite.data} />
        <Button
          title="Reset link"
          variant="ghost"
          size="sm"
          onPress={() =>
            Alert.alert('Reset invite link?', 'Links you already shared will stop working.', [
              { text: 'Cancel', style: 'cancel' },
              { text: 'Reset', style: 'destructive', onPress: () => action.mutate({ type: 'resetInvite' }) },
            ])
          }
        />
      </Card>

      <Card>
        <Text variant="headline">Have an invite code?</Text>
        <View style={[styles.search, styles.codeInput, { backgroundColor: colors.surfaceRaised }]}>
          <TextInput
            value={code}
            onChangeText={(t) => setCode(t.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 8))}
            placeholder="e.g. K7MQ2XPA"
            placeholderTextColor={colors.textTertiary}
            autoCapitalize="characters"
            autoCorrect={false}
            style={[typography.body, styles.searchInput, { color: colors.text, letterSpacing: 2 }]}
            accessibilityLabel="Invite code"
          />
        </View>
        <Button title="Add friend" onPress={useCode} disabled={code.length !== 8} loading={action.isPending} />
      </Card>

      {(requests.data?.outgoing.length ?? 0) > 0 && (
        <View style={{ gap: space.sm }}>
          <Text variant="headline">Sent requests</Text>
          <View style={[styles.panel, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            {requests.data!.outgoing.map((request, i) => (
              <View key={request.id} style={[styles.row, i > 0 && { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border }]}>
                <Avatar user={request.user} size={36} />
                <Text variant="body" style={{ flex: 1 }} numberOfLines={1}>
                  {personName(request.user)}
                </Text>
                <Button
                  title="Cancel"
                  variant="ghost"
                  size="sm"
                  fullWidth={false}
                  onPress={() => action.mutate({ type: 'removeRequest', requestId: request.id })}
                />
              </View>
            ))}
          </View>
        </View>
      )}
    </ScrollView>
  );
}

const actionLabel: Record<Relationship, string> = {
  NONE: 'Add',
  REQUEST_SENT: 'Requested',
  REQUEST_RECEIVED: 'Accept',
  FRIENDS: 'Friends',
};

function SearchRow({ result, first }: { result: UserSearchResult; first: boolean }) {
  const { colors } = useTheme();
  const action = useFriendAction();
  const actionable = result.relationship === 'NONE' || result.relationship === 'REQUEST_RECEIVED';
  return (
    <View style={[styles.row, !first && { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border }]}>
      <Avatar user={result.user} />
      <View style={{ flex: 1 }}>
        <Text variant="body" weight="600" numberOfLines={1}>
          {personName(result.user)}
        </Text>
        <Text variant="footnote" color="textSecondary">
          {handle(result.user)}
        </Text>
      </View>
      {actionable ? (
        <Button
          title={actionLabel[result.relationship]}
          size="sm"
          fullWidth={false}
          loading={action.isPending}
          onPress={() => action.mutate({ type: 'send', username: result.user.username! })}
        />
      ) : (
        <Pressable disabled style={styles.status}>
          <Text variant="footnote" color="textTertiary">
            {actionLabel[result.relationship]}
          </Text>
        </Pressable>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  content: { padding: space.lg, gap: space.lg, paddingBottom: space.xxxl },
  search: { flexDirection: 'row', alignItems: 'center', gap: space.sm, paddingHorizontal: space.md, borderRadius: radius.md, minHeight: hitTarget.min },
  searchInput: { flex: 1, paddingVertical: space.sm },
  codeInput: { marginVertical: space.xs },
  panel: { borderRadius: radius.lg, borderWidth: StyleSheet.hairlineWidth, overflow: 'hidden' },
  row: { flexDirection: 'row', alignItems: 'center', gap: space.md, paddingHorizontal: space.lg, paddingVertical: space.md },
  status: { paddingHorizontal: space.sm },
  code: { letterSpacing: 4, textAlign: 'center', paddingVertical: space.sm },
});
