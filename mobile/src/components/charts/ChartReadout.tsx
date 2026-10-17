import { StyleSheet, View } from 'react-native';

import { Text } from '@/components/ui';
import { radius, space } from '@/theme/tokens';
import { useTheme } from '@/theme/useTheme';

type ChartReadoutProps = {
  value: string;
  label: string;
  detail?: string;
  /** False while showing the default (latest) point rather than a touched one. */
  selected: boolean;
  left: number;
  /** Drawn over the top of the plot (charts without a reserved readout row): gets a backing so it stays legible. */
  overlay?: boolean;
  /** Prefix for the label at rest (default "Latest · "). */
  resting?: string;
};

/**
 * Fixed readout row at the top of a chart. At rest it shows the latest point;
 * while the reader drags across the chart it shows the touched point. It sits
 * in a fixed place rather than following the finger, so the finger never
 * covers it. The value leads in strong text and the label follows in secondary text.
 */
export function ChartReadout({ value, label, detail, selected, left, overlay = false, resting = 'Latest · ' }: ChartReadoutProps) {
  const { colors } = useTheme();
  return (
    <View
      pointerEvents="none"
      style={[styles.readout, { left }, overlay ? [styles.overlay, { backgroundColor: colors.surfaceRaised, borderColor: colors.border }] : styles.row]}
      accessibilityLiveRegion={selected ? 'polite' : 'none'}>
      <Text variant="headline" weight="700">
        {value}
      </Text>
      <Text variant="caption" color="textSecondary" numberOfLines={1}>
        {selected ? '' : resting}
        {label}
        {detail ? ` · ${detail}` : ''}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  readout: { position: 'absolute', top: 0 },
  /** Reserved readout row: spans the plot width. */
  row: { right: 0 },
  /** Floating over the plot: hugs its content. */
  overlay: {
    paddingHorizontal: space.md,
    paddingVertical: space.xs,
    borderRadius: radius.sm,
    borderWidth: StyleSheet.hairlineWidth,
  },
});
