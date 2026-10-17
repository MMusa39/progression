import { StyleSheet, View } from 'react-native';

import { Icon, Text } from '@/components/ui';
import { radius, space } from '@/theme/tokens';
import { useTheme } from '@/theme/useTheme';

/** Wordmark: accent tile with a rising trend line + "Progression". */
export function Logo({ size = 'lg' }: { size?: 'lg' | 'md' }) {
  const { colors } = useTheme();
  const tile = size === 'lg' ? 64 : 40;
  return (
    <View style={styles.row}>
      <View style={[styles.tile, { width: tile, height: tile, backgroundColor: colors.accent }]}>
        <Icon name="trending-up" size={tile * 0.6} color="onAccent" />
      </View>
      {size === 'md' && <Text variant="title2">Progression</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  tile: { borderRadius: radius.lg, alignItems: 'center', justifyContent: 'center' },
});
