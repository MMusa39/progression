/**
 * Slim bar pinned to the bottom of the workout screen while resting:
 * countdown, a progress track, −15s / +15s, and Skip. When rest ends it buzzes
 * and briefly shows "Rest over", then gets out of the way.
 */
import * as Haptics from 'expo-haptics';
import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { Text } from '@/components/ui';
import { radius, space } from '@/theme/tokens';
import { useTheme } from '@/theme/useTheme';

import { requestPermission } from '@/features/notifications/notifications';
import { usePermissionState } from '@/features/notifications/usePermissionState';

import { syncRestNotification } from '../restNotifications';
import { formatRest, remainingSeconds, useRestTimer } from '../restTimer';

const DONE_MESSAGE_MS = 2500;

export function RestTimerBar({ bottomInset }: { bottomInset: number }) {
  const { colors } = useTheme();
  const { endsAt, totalSeconds, adjust, stop, alertWhenDone } = useRestTimer();
  const [now, setNow] = useState(() => Date.now());
  const permission = usePermissionState();

  useEffect(() => {
    if (endsAt === null) return;
    const interval = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(interval);
  }, [endsAt]);

  const remaining = remainingSeconds(endsAt, now);
  const finished = endsAt !== null && remaining === 0;

  // Buzz once when the rest ends, show "Rest over" briefly, then hide.
  useEffect(() => {
    if (!finished) return;
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    const timeout = setTimeout(stop, DONE_MESSAGE_MS);
    return () => clearTimeout(timeout);
  }, [finished, stop]);

  if (endsAt === null) return null;
  const progress = totalSeconds > 0 ? 1 - remaining / totalSeconds : 1;

  return (
    <View
      style={[styles.bar, { backgroundColor: colors.surfaceRaised, borderTopColor: colors.border, paddingBottom: bottomInset + space.sm }]}
      accessibilityLiveRegion="polite">
      <View style={[styles.track, { backgroundColor: colors.border }]}>
        <View style={[styles.fill, { width: `${Math.min(100, progress * 100)}%`, backgroundColor: colors.accent }]} />
      </View>
      <View style={styles.row}>
        <View style={{ flex: 1 }}>
          <Text variant="caption" color="textSecondary">
            {finished ? 'REST OVER' : 'REST'}
          </Text>
          <Text variant="title2" accessibilityLabel={finished ? 'Rest over. Time for your next set.' : `${remaining} seconds of rest left`}>
            {finished ? 'Next set' : formatRest(remaining)}
          </Text>
        </View>
        {!finished && (
          <>
            <TimerButton label="−15" accessibilityLabel="Remove 15 seconds" onPress={() => adjust(-15)} />
            <TimerButton label="+15" accessibilityLabel="Add 15 seconds" onPress={() => adjust(15)} />
          </>
        )}
        <TimerButton label={finished ? 'Done' : 'Skip'} accessibilityLabel={finished ? 'Dismiss' : 'Skip rest'} onPress={stop} emphasized />
      </View>
      {/* One-tap opt-in, asked in context: only while resting, only until answered. */}
      {!finished && permission.state === 'undetermined' && alertWhenDone && (
        <Pressable
          onPress={async () => {
            await requestPermission();
            permission.refresh();
            syncRestNotification(useRestTimer.getState().endsAt, true);
          }}
          accessibilityRole="button"
          style={styles.notify}>
          <Text variant="footnote" weight="600" color="accentText">
            Notify me when rest is over, even if I leave the app
          </Text>
        </Pressable>
      )}
    </View>
  );
}

function TimerButton({ label, onPress, emphasized = false, accessibilityLabel }: {
  label: string;
  onPress: () => void;
  emphasized?: boolean;
  accessibilityLabel: string;
}) {
  const { colors } = useTheme();
  return (
    <Pressable
      onPress={() => {
        Haptics.selectionAsync();
        onPress();
      }}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      style={({ pressed }) => [
        styles.button,
        { backgroundColor: emphasized ? colors.accent : colors.surface, opacity: pressed ? 0.8 : 1 },
      ]}>
      <Text variant="headline" color={emphasized ? 'onAccent' : 'text'}>
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  bar: { position: 'absolute', left: 0, right: 0, bottom: 0, borderTopWidth: StyleSheet.hairlineWidth },
  track: { height: 3 },
  fill: { height: 3 },
  row: { flexDirection: 'row', alignItems: 'center', gap: space.sm, paddingHorizontal: space.lg, paddingTop: space.md },
  notify: { paddingHorizontal: space.lg, paddingTop: space.sm },
  button: { minWidth: 56, height: 44, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center', paddingHorizontal: space.md },
});
