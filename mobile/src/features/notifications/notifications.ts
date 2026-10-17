/**
 * Notifications: permission, push-token registration, and how notifications
 * behave when they arrive.
 *
 * - **Remote push** (friend requests, friends' PRs) is sent by the API through
 *   Expo's push service to this device's Expo push token.
 * - **Local notifications** (rest timer) are scheduled on the device itself
 *   and work even in Expo Go.
 *
 * Permission is never requested on launch, only when the user turns on
 * something that needs it, so the iOS prompt arrives with context.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';
import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import { AppState, Platform } from 'react-native';

import { apiRequest } from '@/features/api/client';

const TOKEN_KEY = 'progression.push-token';

/** Data attached to every notification the app handles. */
export type NotificationData = {
  type?: 'friend_request' | 'friend_accepted' | 'friend_pr' | 'rest';
  /** Screen to open when the notification is tapped. */
  path?: string;
};

/**
 * Foreground behavior: show friend notifications as banners, but stay quiet
 * for the rest alert while the app is open, since the in-app bar already buzzes.
 */
export function configureNotificationHandler() {
  Notifications.setNotificationHandler({
    handleNotification: async (notification) => {
      const data = notification.request.content.data as NotificationData;
      const quiet = data?.type === 'rest' && AppState.currentState === 'active';
      return { shouldShowBanner: !quiet, shouldShowList: !quiet, shouldPlaySound: !quiet, shouldSetBadge: false };
    },
  });
}

export type PermissionState = 'granted' | 'denied' | 'undetermined';

export async function permissionState(): Promise<PermissionState> {
  if (Platform.OS === 'web') return 'denied';
  const settings = await Notifications.getPermissionsAsync();
  if (settings.granted || settings.ios?.status === Notifications.IosAuthorizationStatus.PROVISIONAL) return 'granted';
  return settings.canAskAgain ? 'undetermined' : 'denied';
}

/** Shows the system prompt (once; iOS never shows it again after a "Don't Allow"). */
export async function requestPermission(): Promise<PermissionState> {
  if (Platform.OS === 'web') return 'denied';
  await Notifications.requestPermissionsAsync({ ios: { allowAlert: true, allowBadge: false, allowSound: true } });
  return permissionState();
}

export type PushRegistration =
  | { status: 'registered' }
  | { status: 'denied' }
  | { status: 'unsupported'; reason: string };

/**
 * Gets this device's Expo push token and registers it with the API. Safe to
 * call on every launch: the server upserts, and tokens can change.
 */
export async function registerForPush({ prompt = false } = {}): Promise<PushRegistration> {
  if (Platform.OS === 'web') return { status: 'unsupported', reason: 'Push notifications need the iOS or Android app.' };
  if (!Device.isDevice) return { status: 'unsupported', reason: 'Push notifications need a physical device, not a simulator.' };

  const state = prompt ? await requestPermission() : await permissionState();
  if (state !== 'granted') return { status: 'denied' };

  const projectId = Constants.expoConfig?.extra?.eas?.projectId ?? Constants.easConfig?.projectId;
  if (!projectId) {
    return { status: 'unsupported', reason: 'Push needs an Expo project ID (run `eas init` in mobile/). Rest alerts still work.' };
  }
  try {
    const { data: token } = await Notifications.getExpoPushTokenAsync({ projectId });
    await apiRequest('/api/v1/me/push-tokens', {
      method: 'POST',
      body: { token, platform: Platform.OS === 'ios' ? 'IOS' : 'ANDROID' },
    });
    await AsyncStorage.setItem(TOKEN_KEY, token);
    return { status: 'registered' };
  } catch (error) {
    return { status: 'unsupported', reason: error instanceof Error ? error.message : "Couldn't register for push." };
  }
}

/**
 * Stops push to this device for the signed-in user. Call before signing out,
 * while the session is still valid. Best effort: failures are ignored.
 */
export async function unregisterPush(): Promise<void> {
  const token = await AsyncStorage.getItem(TOKEN_KEY).catch(() => null);
  if (!token) return;
  await apiRequest(`/api/v1/me/push-tokens/${encodeURIComponent(token)}`, { method: 'DELETE' }).catch(() => {});
  await AsyncStorage.removeItem(TOKEN_KEY).catch(() => {});
}
