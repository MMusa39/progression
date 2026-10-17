import { Stack } from 'expo-router';

import { useTheme } from '@/theme/useTheme';

/** Navigation stack for one tab: large collapsing title on the root screen, themed headers. */
export function TabStack({ title }: { title: string }) {
  const { colors } = useTheme();
  return (
    <Stack
      screenOptions={{
        headerTintColor: colors.accentText,
        headerTitleStyle: { color: colors.text },
        headerLargeTitleStyle: { color: colors.text },
        headerShadowVisible: false,
        headerLargeTitleShadowVisible: false,
        headerStyle: { backgroundColor: colors.background },
        headerBackButtonDisplayMode: 'minimal',
        contentStyle: { backgroundColor: colors.background },
      }}>
      <Stack.Screen name="index" options={{ title, headerLargeTitleEnabled: true }} />
    </Stack>
  );
}
