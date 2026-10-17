import { StyleSheet, View } from 'react-native';

import { radius, space } from '@/theme/tokens';
import { useTheme } from '@/theme/useTheme';

import { Text } from './Text';

/** A labeled number, e.g. "Volume / 12,340 lb". Used in rows of 2–3. */
export function StatTile({ label, value }: { label: string; value: string }) {
  const { colors } = useTheme();
  return (
    <View style={[styles.tile, { backgroundColor: colors.surface, borderColor: colors.border }]}>
      <Text variant="caption" color="textSecondary">
        {label.toUpperCase()}
      </Text>
      {/* Proportional digits: tabular figures are for aligned columns, not standalone values. */}
      <Text variant="title2" style={styles.value} numberOfLines={1} adjustsFontSizeToFit>
        {value}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  tile: { flex: 1, padding: space.md, borderRadius: radius.md, borderWidth: StyleSheet.hairlineWidth, gap: space.xxs },
  value: { fontSize: 20, lineHeight: 26 },
});
