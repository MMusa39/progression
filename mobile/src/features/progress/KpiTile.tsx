import { StyleSheet, View } from 'react-native';

import { Text } from '@/components/ui';
import { radius, space } from '@/theme/tokens';
import { useTheme } from '@/theme/useTheme';

import { Delta } from './Delta';

type KpiTileProps = {
  label: string;
  value: string;
  /** Signed change vs the previous period, already in display units. */
  change?: { value: number; text: string; percent: number | null } | null;
};

/**
 * Headline number for a range: label, value, and an optional change vs the
 * previous period. Values use proportional figures; tabular figures are only
 * for aligned columns.
 */
export function KpiTile({ label, value, change }: KpiTileProps) {
  const { colors } = useTheme();
  return (
    <View style={[styles.tile, { backgroundColor: colors.surface, borderColor: colors.border }]} accessible accessibilityLabel={`${label}: ${value}`}>
      <Text variant="caption" color="textSecondary">
        {label}
      </Text>
      <Text variant="title2" numberOfLines={1} adjustsFontSizeToFit>
        {value}
      </Text>
      {change && <Delta value={change.value} text={change.text} percent={change.percent} compact />}
    </View>
  );
}

const styles = StyleSheet.create({
  tile: { flex: 1, padding: space.md, borderRadius: radius.md, borderWidth: StyleSheet.hairlineWidth, gap: 2 },
});
