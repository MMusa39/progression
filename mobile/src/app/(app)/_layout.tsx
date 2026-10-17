/**
 * Signed-in area: the tab bar plus screens presented on top of it.
 * Also starts background work that should run whenever the user is signed in.
 */
import { useQueryClient } from '@tanstack/react-query';
import { Stack } from 'expo-router';
import { useEffect } from 'react';
import { AppState } from 'react-native';

import { OfflineBanner } from '@/components/ui';
import { useExercises, useMe } from '@/features/api/queries';
import { configureNotificationHandler, registerForPush } from '@/features/notifications/notifications';
import { useNotificationTaps } from '@/features/notifications/useNotificationTaps';
import { startRestNotificationSync } from '@/features/workout/restNotifications';
import { useWorkoutSync } from '@/features/workout/workoutSync';
import { useTheme } from '@/theme/useTheme';

export default function AppLayout() {
  const { colors } = useTheme();
  useBackgroundSync();
  useNotifications();
  // Warm the cache so the exercise picker and unit preference are ready instantly.
  useMe();
  useExercises();

  return (
    <>
      <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.background } }}>
        <Stack.Screen name="(tabs)" />
        {/* Active workout: a full-height sheet that can be swiped down and resumed later. */}
        <Stack.Screen name="workout" options={{ presentation: 'modal' }} />
        <Stack.Screen name="workout-complete" options={{ presentation: 'modal' }} />
        <Stack.Screen name="invite/[code]" options={{ presentation: 'modal' }} />
        <Stack.Screen name="weigh-in" options={{ presentation: 'modal' }} />
        <Stack.Screen
          name="plates"
          options={{
            presentation: 'modal',
            headerTintColor: colors.accentText,
            headerTitleStyle: { color: colors.text },
            headerStyle: { backgroundColor: colors.background },
            headerShadowVisible: false,
          }}
        />
        <Stack.Screen
          name="exercise-picker"
          options={{
            presentation: 'modal',
            headerShown: true,
            title: 'Add Exercises',
            headerTintColor: colors.accentText,
            headerTitleStyle: { color: colors.text },
            headerStyle: { backgroundColor: colors.background },
            headerShadowVisible: false,
          }}
        />
      </Stack>
      <OfflineBanner />
    </>
  );
}

configureNotificationHandler();

/**
 * Notification wiring for the signed-in app: tap routing, the rest-timer
 * alert, and refreshing this device's push token if permission was already given.
 */
function useNotifications() {
  useNotificationTaps();
  useEffect(() => {
    const stop = startRestNotificationSync();
    registerForPush(); // silent: never prompts here
    return stop;
  }, []);
}

/** Uploads finished workouts now, and again every time the app returns to the foreground. */
function useBackgroundSync() {
  const queryClient = useQueryClient();
  const flush = useWorkoutSync((s) => s.flush);

  useEffect(() => {
    flush(queryClient);
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') flush(queryClient);
    });
    return () => subscription.remove();
  }, [flush, queryClient]);
}
