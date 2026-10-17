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
import { DarkTheme, DefaultTheme, Stack, ThemeProvider, type ErrorBoundaryProps } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { View } from 'react-native';

import { Button, EmptyState } from '@/components/ui';
import { env } from '@/config/env';

import { AuthProvider, useSession } from '@/features/auth/AuthProvider';
import { useActiveWorkout } from '@/features/workout/activeWorkoutStore';
import { useWorkoutSync } from '@/features/workout/workoutSync';
import { queryClient } from '@/lib/queryClient';
import { installWebAlert } from '@/lib/webAlert';
import { useTheme } from '@/theme/useTheme';

SplashScreen.preventAutoHideAsync();
installWebAlert();

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

/**
 * Shown instead of a white screen if rendering crashes anywhere below. Expo
 * Router renders the nearest exported ErrorBoundary; this is the last resort.
 */
export function ErrorBoundary({ error, retry }: ErrorBoundaryProps) {
  const { colors } = useTheme();
  return (
    <View style={{ flex: 1, backgroundColor: colors.background, justifyContent: 'center' }}>
      <EmptyState
        icon="warning-outline"
        title="Something went wrong"
        message={`Your logged data is safe. Try again, and if it keeps happening, restart the app.${__DEV__ ? `\n\n${error.message}` : ''}`}
        action={<Button title="Try again" fullWidth={false} onPress={retry} />}
      />
    </View>
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
  if (env.configError) {
    return <EmptyState icon="construct-outline" title="App not configured" message={env.configError} />;
  }

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
