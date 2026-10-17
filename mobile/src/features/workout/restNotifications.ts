/**
 * Keeps a local "rest over" notification in sync with the rest timer, so the
 * alert still arrives when the phone is locked or another app is open.
 *
 * It subscribes to the timer store instead of being called from it, so the
 * timer logic stays free of side effects (and simple to test).
 */
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

import { permissionState } from '@/features/notifications/notifications';

import { useRestTimer } from './restTimer';

let scheduledId: string | null = null;

async function cancelScheduled() {
  if (scheduledId) {
    const id = scheduledId;
    scheduledId = null;
    await Notifications.cancelScheduledNotificationAsync(id).catch(() => {});
  }
}

export async function syncRestNotification(endsAt: number | null, enabled: boolean, now = Date.now()) {
  await cancelScheduled();
  if (Platform.OS === 'web' || endsAt === null || !enabled) return;
  const seconds = Math.round((endsAt - now) / 1000);
  if (seconds < 1 || (await permissionState()) !== 'granted') return;
  scheduledId = await Notifications.scheduleNotificationAsync({
    content: {
      title: 'Rest over',
      body: 'Time for your next set.',
      sound: 'default',
      data: { type: 'rest', path: '/workout' },
    },
    trigger: { type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL, seconds },
  });
}

/** Starts the sync. Returns an unsubscribe function. */
export function startRestNotificationSync(): () => void {
  return useRestTimer.subscribe((state, previous) => {
    if (state.endsAt !== previous.endsAt || state.alertWhenDone !== previous.alertWhenDone) {
      syncRestNotification(state.endsAt, state.alertWhenDone);
    }
  });
}
