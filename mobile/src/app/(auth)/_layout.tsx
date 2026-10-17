import { Stack } from 'expo-router';

import { useTheme } from '@/theme/useTheme';

/** Signed-out flow. Screens get a minimal back-button header except the welcome screen. */
export default function AuthLayout() {
  const { colors } = useTheme();
  return (
    <Stack
      screenOptions={{
        headerTransparent: true,
        headerTitle: '',
        headerShadowVisible: false,
        headerTintColor: colors.text,
        headerBackButtonDisplayMode: 'minimal',
        contentStyle: { backgroundColor: colors.background },
      }}>
      <Stack.Screen name="index" options={{ headerShown: false }} />
    </Stack>
  );
}
