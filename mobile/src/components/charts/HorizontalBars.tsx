/**
 * Ranked horizontal bars with the value at each bar's tip, e.g. sets per muscle
 * group. One series, so one color for every bar (never darker-for-bigger: bar
 * length already shows size). Every value is printed, so nothing hides behind a tooltip.
 */
import { StyleSheet, View } from 'react-native';

import { Text } from '@/components/ui';
import { radius, space } from '@/theme/tokens';
import { useTheme } from '@/theme/useTheme';

type HorizontalBarsProps = {
  data: { key: string; label: string; value: number }[];
  formatValue?: (value: number) => string;
};

const BAR_HEIGHT = 14;

export function HorizontalBars({ data, formatValue = String }: HorizontalBarsProps) {
  const { colors } = useTheme();
  const max = Math.max(...data.map((d) => d.value), 1);
  return (
    <View style={styles.list}>
      {data.map((d) => (
        <View key={d.key} style={styles.row} accessible accessibilityLabel={`${d.label}: ${formatValue(d.value)}`}>
          <Text variant="subhead" color="textSecondary" style={styles.label} numberOfLines={1}>
            {d.label}
          </Text>
          <View style={styles.track}>
            <View style={[styles.bar, { width: `${(d.value / max) * 100}%`, backgroundColor: colors.chart }]} />
            <Text variant="footnote" weight="600" style={styles.value}>
              {formatValue(d.value)}
            </Text>
          </View>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  list: { gap: space.sm },
  row: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  label: { width: 88 },
  track: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: space.sm, paddingRight: 36 },
  bar: {
    height: BAR_HEIGHT,
    minWidth: 2,
    // Rounded data end, square at the baseline.
    borderTopRightRadius: radius.sm / 2,
    borderBottomRightRadius: radius.sm / 2,
  },
  value: { fontVariant: ['tabular-nums'] },
});
