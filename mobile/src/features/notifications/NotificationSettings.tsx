/** Profile section: turn notifications on, and choose which kinds to receive. */
import { useState } from 'react';
import { Linking, StyleSheet, Switch, View } from 'react-native';

import { Button, Card, Text } from '@/components/ui';
import { useMe, useUpdateMe } from '@/features/api/queries';
import { useRestTimer } from '@/features/workout/restTimer';
import { space } from '@/theme/tokens';
import { useTheme } from '@/theme/useTheme';

import { registerForPush, type PushRegistration } from './notifications';
import { usePermissionState } from './usePermissionState';

export function NotificationSettings() {
  const { colors } = useTheme();
  const { state, refresh } = usePermissionState();
  const me = useMe();
  const updateMe = useUpdateMe();
  const alertWhenDone = useRestTimer((s) => s.alertWhenDone);
  const [registration, setRegistration] = useState<PushRegistration | null>(null);
  const [busy, setBusy] = useState(false);

  const turnOn = async () => {
    setBusy(true);
    setRegistration(await registerForPush({ prompt: true }));
    refresh();
    setBusy(false);
  };

  const toggle = (label: string, value: boolean, onChange: (v: boolean) => void, description: string) => (
    <View style={styles.row}>
      <View style={{ flex: 1 }}>
        <Text variant="body">{label}</Text>
        <Text variant="footnote" color="textSecondary">
          {description}
        </Text>
      </View>
      <Switch value={value} onValueChange={onChange} disabled={state !== 'granted'} trackColor={{ true: colors.accent }} accessibilityLabel={label} />
    </View>
  );

  return (
    <Card>
      <Text variant="headline">Notifications</Text>
      {state === 'undetermined' && (
        <>
          <Text variant="footnote" color="textSecondary">
            Get an alert when rest is over, when friends add you, and when they set a PR.
          </Text>
          <Button title="Turn on notifications" icon="notifications-outline" size="md" onPress={turnOn} loading={busy} />
        </>
      )}
      {state === 'denied' && (
        <>
          <Text variant="footnote" color="textSecondary">
            Notifications are turned off for Progression in your phone&apos;s settings.
          </Text>
          <Button title="Open Settings" variant="secondary" size="md" onPress={() => Linking.openSettings()} />
        </>
      )}
      {toggle('Rest timer', alertWhenDone, (v) => useRestTimer.getState().setAlertWhenDone(v), 'When rest is over and the app is in the background')}
      {toggle('Friend requests', me.data?.notifyFriendRequests ?? true, (v) => updateMe.mutate({ notifyFriendRequests: v }), 'When someone adds you or accepts your request')}
      {toggle("Friends' PRs", me.data?.notifyFriendPrs ?? true, (v) => updateMe.mutate({ notifyFriendPrs: v }), 'When a friend sets a personal record')}
      {registration?.status === 'unsupported' && (
        <Text variant="caption" color="textTertiary">
          {registration.reason}
        </Text>
      )}
    </Card>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: space.md, paddingTop: space.sm },
});
