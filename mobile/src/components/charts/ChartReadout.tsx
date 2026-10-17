import { StyleSheet, View } from 'react-native';

import { Text } from '@/components/ui';

type ChartReadoutProps = {
  value: string;
  label: string;
  detail?: string;
  /** False while showing the default (latest) point rather than a touched one. */
  selected: boolean;
  left: number;
};

/**
 * Fixed readout row at the top of a chart. At rest it shows the latest point;
 * while the reader drags across the chart it shows the touched point. It sits
 * in a fixed place rather than following the finger, so the finger never
 * covers it. The value leads in strong text and the label follows in secondary text.
 */
export function ChartReadout({ value, label, detail, selected, left }: ChartReadoutProps) {
  return (
    <View pointerEvents="none" style={[styles.readout, { left }]} accessibilityLiveRegion={selected ? 'polite' : 'none'}>
      <Text variant="headline" weight="700">
        {value}
      </Text>
      <Text variant="caption" color="textSecondary" numberOfLines={1}>
        {selected ? '' : 'Latest · '}
        {label}
        {detail ? ` · ${detail}` : ''}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  readout: { position: 'absolute', top: 0, right: 0 },
});
