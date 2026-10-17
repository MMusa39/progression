/**
 * Bottom tab bar using the platform's native tab bar (UITabBarController on iOS,
 * Material bottom navigation on Android), so it gets system behavior like
 * Liquid Glass on iOS 26 for free. Each tab owns its own navigation stack.
 */
import { NativeTabs } from 'expo-router/native-tabs';

import { useTheme } from '@/theme/useTheme';

export default function TabsLayout() {
  const { colors } = useTheme();
  return (
    <NativeTabs tintColor={colors.accentText} minimizeBehavior="onScrollDown">
      <NativeTabs.Trigger name="(home)">
        <NativeTabs.Trigger.Label>Workout</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon sf="dumbbell.fill" md="fitness_center" />
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="history">
        <NativeTabs.Trigger.Label>History</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon sf="clock.arrow.circlepath" md="history" />
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="progress">
        <NativeTabs.Trigger.Label>Progress</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon sf="chart.line.uptrend.xyaxis" md="trending_up" />
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="profile">
        <NativeTabs.Trigger.Label>Profile</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon sf="person.crop.circle" md="person" />
      </NativeTabs.Trigger>
    </NativeTabs>
  );
}
