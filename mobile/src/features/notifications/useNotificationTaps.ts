import * as Notifications from 'expo-notifications';
import { router, type Href } from 'expo-router';
import { useEffect } from 'react';

import type { NotificationData } from './notifications';

/**
 * Opens the screen a notification points to when it's tapped, including the
 * tap that launched the app from a closed state.
 */
export function useNotificationTaps() {
  const lastResponse = Notifications.useLastNotificationResponse();

  useEffect(() => {
    if (!lastResponse || lastResponse.actionIdentifier !== Notifications.DEFAULT_ACTION_IDENTIFIER) return;
    const data = lastResponse.notification.request.content.data as NotificationData;
    if (data?.path) {
      router.push(data.path as Href);
    }
  }, [lastResponse]);
}
