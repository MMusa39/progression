/**
 * Signed-in area: the tab bar plus screens presented on top of it.
 * Also starts background work that should run whenever the user is signed in.
 */
import { useQueryClient } from '@tanstack/react-query';
import { Stack } from 'expo-router';
import { useEffect } from 'react';
import { AppState } from 'react-native';

import { useExercises, useMe } from '@/features/api/queries';
import { useWorkoutSync } from '@/features/workout/workoutSync';
import { useTheme } from '@/theme/useTheme';

export default function AppLayout() {
  const { colors } = useTheme();
  useBackgroundSync();
  // Warm the cache so the exercise picker and unit preference are ready instantly.
  useMe();
  useExercises();

  return (
    <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.background } }}>
      <Stack.Screen name="(tabs)" />
      {/* Active workout: a full-height sheet that can be swiped down and resumed later. */}
      <Stack.Screen name="workout" options={{ presentation: 'modal' }} />
      <Stack.Screen name="workout-complete" options={{ presentation: 'modal' }} />
      <Stack.Screen name="invite/[code]" options={{ presentation: 'modal' }} />
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
  );
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
