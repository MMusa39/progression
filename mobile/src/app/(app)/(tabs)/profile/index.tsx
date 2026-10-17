/** Profile: who's signed in, preferences, and sign out. */
import Constants from 'expo-constants';
import { Alert, ScrollView, StyleSheet, View } from 'react-native';

import { Button, Card, Icon, SegmentedControl, Text } from '@/components/ui';
import { env } from '@/config/env';
import { useMe, useUpdateMe } from '@/features/api/queries';
import type { WeightUnit } from '@/features/api/types';
import { useSession } from '@/features/auth/AuthProvider';
import { authSession } from '@/features/auth/session';
import { useWorkoutSync } from '@/features/workout/workoutSync';
import { radius, space } from '@/theme/tokens';
import { useTheme } from '@/theme/useTheme';

const providerLabel = { password: 'Email or phone', google: 'Google', dev: 'Development account' } as const;

export default function ProfileScreen() {
  const { colors } = useTheme();
  const session = useSession();
  const me = useMe();
  const updateMe = useUpdateMe();
  const pendingUploads = useWorkoutSync((s) => s.pending.length);

  if (session.status !== 'signedIn') return null;
  const { user } = session;
  const displayName = me.data?.displayName ?? user.name ?? user.email ?? user.phoneNumber ?? 'Lifter';
  const initials = displayName
    .split(/[\s@]/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]!.toUpperCase())
    .join('');

  const confirmSignOut = () =>
    Alert.alert(
      'Sign out?',
      pendingUploads > 0
        ? `${pendingUploads} workout${pendingUploads > 1 ? 's haven\'t' : ' hasn\'t'} synced yet and will be lost if you sign out now.`
        : 'You can sign back in at any time. Your workouts are saved to your account.',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Sign out', style: 'destructive', onPress: () => authSession.signOut() },
      ],
    );

  return (
    <ScrollView contentInsetAdjustmentBehavior="automatic" contentContainerStyle={styles.content}>
      <Card style={styles.identity}>
        <View style={[styles.avatar, { backgroundColor: colors.accent }]}>
          <Text variant="title2" color="onAccent">
            {initials}
          </Text>
        </View>
        <View style={{ flex: 1, gap: 2 }}>
          <Text variant="headline">{displayName}</Text>
          {(user.email || user.phoneNumber) && (
            <Text variant="footnote" color="textSecondary">
              {user.email ?? user.phoneNumber}
            </Text>
          )}
          <View style={styles.provider}>
            <Icon name={user.provider === 'google' ? 'logo-google' : 'key-outline'} size={12} color="textTertiary" />
            <Text variant="caption" color="textTertiary">
              {providerLabel[user.provider]}
            </Text>
          </View>
        </View>
      </Card>

      <Text variant="footnote" weight="600" color="textSecondary" style={styles.sectionLabel}>
        PREFERENCES
      </Text>
      <Card>
        <Text variant="headline">Weight unit</Text>
        <Text variant="footnote" color="textSecondary">
          Used for new sets and totals. Past sets keep the unit they were logged in.
        </Text>
        <SegmentedControl<WeightUnit>
          accessibilityLabel="Weight unit"
          options={[
            { value: 'LB', label: 'Pounds (lb)' },
            { value: 'KG', label: 'Kilograms (kg)' },
          ]}
          value={me.data?.weightUnit ?? 'LB'}
          onChange={(weightUnit) => updateMe.mutate({ weightUnit })}
        />
      </Card>

      <Button title="Sign out" variant="danger" icon="log-out-outline" onPress={confirmSignOut} style={{ marginTop: space.lg }} />

      <Text variant="caption" color="textTertiary" align="center">
        Progression v{Constants.expoConfig?.version}
        {__DEV__ ? ` · API ${env.apiUrl}` : ''}
      </Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { padding: space.lg, gap: space.md, paddingBottom: space.xxxl },
  identity: { flexDirection: 'row', alignItems: 'center', gap: space.lg },
  avatar: { width: 56, height: 56, borderRadius: radius.pill, alignItems: 'center', justifyContent: 'center' },
  provider: { flexDirection: 'row', alignItems: 'center', gap: space.xs, marginTop: 2 },
  sectionLabel: { marginTop: space.md, marginLeft: space.xs },
});
