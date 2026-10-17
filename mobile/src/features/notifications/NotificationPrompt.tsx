/**
 * In-context ask on the Friends tab: explains the benefit before the iOS
 * permission prompt appears. "Not now" hides it for good on this device.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { Button, Card, Icon, Text } from '@/components/ui';
import { space } from '@/theme/tokens';

import { registerForPush } from './notifications';
import { usePermissionState } from './usePermissionState';

const DISMISSED_KEY = 'progression.notification-prompt-dismissed';

export function NotificationPrompt() {
  const { state, refresh } = usePermissionState();
  const [dismissed, setDismissed] = useState<boolean | null>(null);

  useEffect(() => {
    AsyncStorage.getItem(DISMISSED_KEY)
      .then((value) => setDismissed(value === 'true'))
      .catch(() => setDismissed(false));
  }, []);

  if (state !== 'undetermined' || dismissed !== false) return null;

  const dismiss = () => {
    setDismissed(true);
    AsyncStorage.setItem(DISMISSED_KEY, 'true').catch(() => {});
  };

  return (
    <Card style={styles.card}>
      <View style={styles.header}>
        <Icon name="notifications-outline" size={20} color="accentText" />
        <Text variant="headline" style={{ flex: 1 }}>
          Know when friends add you or hit a PR
        </Text>
      </View>
      <View style={styles.actions}>
        <Button
          title="Turn on"
          size="sm"
          fullWidth={false}
          onPress={async () => {
            await registerForPush({ prompt: true });
            refresh();
          }}
        />
        <Button title="Not now" variant="ghost" size="sm" fullWidth={false} onPress={dismiss} />
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  card: { gap: space.md },
  header: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  actions: { flexDirection: 'row', gap: space.sm },
});
