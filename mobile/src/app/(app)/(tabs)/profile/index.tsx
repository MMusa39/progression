/** Profile: who's signed in, preferences, your data (export, delete), legal, and sign out. */
import Constants from 'expo-constants';
import { router } from 'expo-router';
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, Switch, View } from 'react-native';
import { useState } from 'react';

import { Button, Card, Icon, SegmentedControl, Text } from '@/components/ui';
import { env } from '@/config/env';
import { deleteAccount, exportData } from '@/features/account/account';
import { useMe, useUpdateMe } from '@/features/api/queries';
import type { WeightUnit } from '@/features/api/types';
import { useSession } from '@/features/auth/AuthProvider';
import { UsernameForm } from '@/features/friends/UsernameForm';
import { NotificationSettings } from '@/features/notifications/NotificationSettings';
import { unregisterPush } from '@/features/notifications/notifications';
import { authSession } from '@/features/auth/session';
import { formatRest, REST_OPTIONS, useRestTimer, type RestOption } from '@/features/workout/restTimer';
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
  const restDefault = useRestTimer((s) => s.defaultSeconds);
  const [editingUsername, setEditingUsername] = useState(false);
  const [busy, setBusy] = useState<'export' | 'delete' | null>(null);

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
        {
          text: 'Sign out',
          style: 'destructive',
          onPress: async () => {
            await unregisterPush(); // stop this phone getting the account's notifications
            await authSession.signOut();
          },
        },
      ],
    );

  const runExport = async () => {
    setBusy('export');
    try {
      if (!(await exportData())) Alert.alert('Export works on your phone', 'Open Progression on your iPhone to save or share your data.');
    } catch (error) {
      Alert.alert("Couldn't export", error instanceof Error ? error.message : 'Please try again.');
    } finally {
      setBusy(null);
    }
  };

  // Two steps, because this can't be undone.
  const confirmDelete = () =>
    Alert.alert(
      'Delete your account?',
      'This permanently deletes your workouts, records, weigh-ins, food diary, recipes and friends. Export your data first if you want a copy.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Continue',
          style: 'destructive',
          onPress: () =>
            Alert.alert('Are you sure?', 'Your account and all of its data will be gone for good.', [
              { text: 'Keep my account', style: 'cancel' },
              {
                text: 'Delete forever',
                style: 'destructive',
                onPress: async () => {
                  setBusy('delete');
                  try {
                    await deleteAccount();
                  } catch (error) {
                    setBusy(null);
                    Alert.alert("Couldn't delete your account", error instanceof Error ? error.message : 'Please try again.');
                  }
                },
              },
            ]),
        },
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

      <Text variant="footnote" weight="600" color="textSecondary" style={styles.sectionLabel}>
        FRIENDS
      </Text>
      <Card>
        <View style={styles.settingRow}>
          <View style={{ flex: 1 }}>
            <Text variant="headline">Username</Text>
            <Text variant="footnote" color="textSecondary">
              {me.data?.username ? `@${me.data.username}` : 'Not set: friends can\u2019t find you yet'}
            </Text>
          </View>
          <Button
            title={editingUsername ? 'Cancel' : me.data?.username ? 'Change' : 'Set'}
            variant="ghost"
            size="sm"
            fullWidth={false}
            onPress={() => setEditingUsername((v) => !v)}
          />
        </View>
        {editingUsername && <UsernameForm current={me.data?.username} onSaved={() => setEditingUsername(false)} />}
      </Card>
      <Card>
        <View style={styles.settingRow}>
          <View style={{ flex: 1 }}>
            <Text variant="headline">Share workouts with friends</Text>
            <Text variant="footnote" color="textSecondary">
              Off: friends only see your PRs and streak.
            </Text>
          </View>
          <Switch
            value={me.data?.shareWorkouts ?? true}
            onValueChange={(shareWorkouts) => updateMe.mutate({ shareWorkouts })}
            trackColor={{ true: colors.accent }}
            accessibilityLabel="Share workouts with friends"
          />
        </View>
      </Card>

      <NotificationSettings />

      <Card>
        <Text variant="headline">Rest timer</Text>
        <Text variant="footnote" color="textSecondary">
          Starts automatically when you tick off a set.
        </Text>
        <SegmentedControl<string>
          accessibilityLabel="Default rest time"
          options={REST_OPTIONS.map((seconds) => ({ value: String(seconds), label: formatRest(seconds) }))}
          value={String(restDefault)}
          onChange={(value) => useRestTimer.getState().setDefault(Number(value) as RestOption)}
        />
      </Card>

      <Text variant="footnote" weight="600" color="textSecondary" style={styles.sectionLabel}>
        YOUR DATA & PRIVACY
      </Text>
      <Card style={{ padding: 0, gap: 0 }}>
        <LinkRow icon="download-outline" label="Export my data" onPress={runExport} busy={busy === 'export'} first />
        <LinkRow icon="shield-checkmark-outline" label="Privacy policy" onPress={() => router.push('/profile/legal/privacy')} />
        <LinkRow icon="document-text-outline" label="Terms of use" onPress={() => router.push('/profile/legal/terms')} />
      </Card>

      <Button title="Sign out" variant="danger" icon="log-out-outline" onPress={confirmSignOut} style={{ marginTop: space.lg }} />
      <Button title="Delete account" variant="dangerText" size="md" onPress={confirmDelete} loading={busy === 'delete'} />

      <Text variant="caption" color="textTertiary" align="center">
        Progression v{Constants.expoConfig?.version}
        {__DEV__ ? ` · API ${env.apiUrl}` : ''}
      </Text>
    </ScrollView>
  );
}

function LinkRow({ icon, label, onPress, busy, first }: {
  icon: 'download-outline' | 'shield-checkmark-outline' | 'document-text-outline';
  label: string;
  onPress: () => void;
  busy?: boolean;
  first?: boolean;
}) {
  const { colors } = useTheme();
  return (
    <Pressable
      onPress={onPress}
      disabled={busy}
      accessibilityRole="button"
      style={({ pressed }) => [
        styles.linkRow,
        !first && { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border },
        pressed && { backgroundColor: colors.surfaceRaised },
      ]}>
      <Icon name={icon} size={20} color="accentText" />
      <Text variant="body" style={{ flex: 1 }}>
        {label}
      </Text>
      {busy ? <ActivityIndicator /> : <Icon name="chevron-forward" size={16} color="textTertiary" />}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  content: { padding: space.lg, gap: space.md, paddingBottom: space.xxxl },
  identity: { flexDirection: 'row', alignItems: 'center', gap: space.lg },
  avatar: { width: 56, height: 56, borderRadius: radius.pill, alignItems: 'center', justifyContent: 'center' },
  provider: { flexDirection: 'row', alignItems: 'center', gap: space.xs, marginTop: 2 },
  sectionLabel: { marginTop: space.md, marginLeft: space.xs },
  settingRow: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  linkRow: { flexDirection: 'row', alignItems: 'center', gap: space.md, paddingHorizontal: space.lg, minHeight: 50 },
});
