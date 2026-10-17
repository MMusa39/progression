import { useNetworkState } from 'expo-network';
import { StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { radius, space } from '@/theme/tokens';
import { useTheme } from '@/theme/useTheme';

import { Icon } from './Icon';
import { Text } from './Text';

/**
 * A small pill at the top of the screen while the phone has no internet.
 * Logging keeps working offline: workouts save on the phone and sync later.
 */
export function OfflineBanner() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const network = useNetworkState();
  // Only an explicit "not reachable": unknown (still checking) shouldn't flash a warning.
  if (network.isInternetReachable !== false) return null;
  return (
    <View pointerEvents="none" style={[styles.wrap, { top: insets.top + space.xs }]} accessibilityLiveRegion="polite">
      <View style={[styles.pill, { backgroundColor: colors.surfaceRaised, borderColor: colors.border }]}>
        <Icon name="cloud-offline-outline" size={14} color="textSecondary" />
        <Text variant="caption" color="textSecondary">
          Offline · workouts save on your phone and sync later
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { position: 'absolute', left: 0, right: 0, alignItems: 'center', zIndex: 10 },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.xs,
    paddingHorizontal: space.md,
    paddingVertical: space.xs + 1,
    borderRadius: radius.pill,
    borderWidth: StyleSheet.hairlineWidth,
  },
});
