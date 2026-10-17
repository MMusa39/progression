import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';

import { radius, space } from '@/theme/tokens';
import { useTheme } from '@/theme/useTheme';

import { Icon, type IconName } from './Icon';
import { Text } from './Text';

type EmptyStateProps = {
  icon: IconName;
  title: string;
  message: string;
  action?: ReactNode;
};

/** Friendly placeholder for empty lists and not-yet-available features. */
export function EmptyState({ icon, title, message, action }: EmptyStateProps) {
  const { colors } = useTheme();
  return (
    <View style={styles.container}>
      <View style={[styles.badge, { backgroundColor: colors.accentMuted }]}>
        <Icon name={icon} size={32} color="accentText" />
      </View>
      <Text variant="title2" align="center">
        {title}
      </Text>
      <Text variant="callout" color="textSecondary" align="center" style={styles.message}>
        {message}
      </Text>
      {action}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { alignItems: 'center', justifyContent: 'center', gap: space.md, paddingVertical: space.xxxl },
  badge: { width: 72, height: 72, borderRadius: radius.pill, alignItems: 'center', justifyContent: 'center' },
  message: { maxWidth: 300, marginBottom: space.sm },
});
