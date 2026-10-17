import * as Notifications from 'expo-notifications';
import { router, type Href } from 'expo-router';
import { useEffect } from 'react';
import { Platform } from 'react-native';

import type { NotificationData } from './notifications';

/**
 * Opens the screen a notification points to when it's tapped, including the
 * tap that launched the app from a closed state.
 */
export const useNotificationTaps: () => void =
  // Notification responses don't exist on web (the dev preview), and the call throws there.
  Platform.OS === 'web' ? () => {} : useNativeNotificationTaps;

function useNativeNotificationTaps() {
  const lastResponse = Notifications.useLastNotificationResponse();

  useEffect(() => {
    if (!lastResponse || lastResponse.actionIdentifier !== Notifications.DEFAULT_ACTION_IDENTIFIER) return;
    const data = lastResponse.notification.request.content.data as NotificationData;
    if (data?.path) {
      router.push(data.path as Href);
    }
  }, [lastResponse]);
}
