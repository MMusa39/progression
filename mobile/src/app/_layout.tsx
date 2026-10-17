/**
 * Root layout: app-wide providers, the splash screen, and the auth guard that
 * decides which half of the app is reachable.
 *
 *   signed out → (auth) group: welcome, sign up, sign in, verification
 *   signed in  → (app) group:  tabs, active workout, exercise picker
 *
 * `Stack.Protected` removes the other group from navigation entirely, so a
 * signed-out user can't deep-link into the app and a signed-in user never sees
 * the welcome screen. When the session changes, the router moves over automatically.
 */
import { QueryClientProvider } from '@tanstack/react-query';
import { DarkTheme, DefaultTheme, Stack, ThemeProvider } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';

import { AuthProvider, useSession } from '@/features/auth/AuthProvider';
import { useActiveWorkout } from '@/features/workout/activeWorkoutStore';
import { useWorkoutSync } from '@/features/workout/workoutSync';
import { queryClient } from '@/lib/queryClient';
import { useTheme } from '@/theme/useTheme';

SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const { scheme, colors } = useTheme();
  const base = scheme === 'dark' ? DarkTheme : DefaultTheme;
  const navigationTheme = {
    ...base,
    colors: { ...base.colors, background: colors.background, card: colors.background, primary: colors.accentText, text: colors.text, border: colors.border },
  };

  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <ThemeProvider value={navigationTheme}>
          <StatusBar style={scheme === 'dark' ? 'light' : 'dark'} />
          <RootNavigator />
        </ThemeProvider>
      </AuthProvider>
    </QueryClientProvider>
  );
}

function RootNavigator() {
  const session = useSession();
  const signedIn = session.status === 'signedIn';

  useEffect(() => {
    if (session.status !== 'loading') SplashScreen.hideAsync();
    if (session.status === 'signedOut') {
      // Never leave one user's data on screen (or on disk) for the next.
      queryClient.clear();
      useActiveWorkout.getState().discard();
      useWorkoutSync.getState().clear();
    }
  }, [session.status]);

  // Keep the splash screen up until we know whether a session exists.
  if (session.status === 'loading') return null;

  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Protected guard={signedIn}>
        <Stack.Screen name="(app)" />
      </Stack.Protected>
      <Stack.Protected guard={!signedIn}>
        <Stack.Screen name="(auth)" />
      </Stack.Protected>
    </Stack>
  );
}
