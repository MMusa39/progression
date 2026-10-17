import { StyleSheet, View } from 'react-native';

import { Text } from '@/components/ui';
import type { UserSummary } from '@/features/api/types';
import { radius } from '@/theme/tokens';
import { useTheme } from '@/theme/useTheme';

import { initials } from './names';

/** Initials in a circle. The current user gets the accent color so "you" stands out in lists. */
export function Avatar({ user, size = 40, you = false }: { user: UserSummary; size?: number; you?: boolean }) {
  const { colors } = useTheme();
  return (
    <View
      style={[styles.circle, { width: size, height: size, backgroundColor: you ? colors.accent : colors.surfaceRaised }]}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants">
      <Text variant={size >= 56 ? 'title2' : 'subhead'} weight="700" color={you ? 'onAccent' : 'textSecondary'}>
        {initials(user)}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  circle: { borderRadius: radius.pill, alignItems: 'center', justifyContent: 'center' },
});
