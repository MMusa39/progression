import { StyleSheet, Text } from 'react-native';

import { useTheme } from '@/theme/useTheme';

type AxisLabelProps = {
  text: string;
  /** Anchor point in chart pixels. */
  x: number;
  y: number;
  align: 'left' | 'center' | 'right';
};

const BOX = 80;

/**
 * Chart text drawn as native Text, not SVG text, so labels use the system font
 * (SVG text falls back to a platform-dependent default face) and tabular
 * digits, which keep tick labels aligned in a column.
 */
export function AxisLabel({ text, x, y, align }: AxisLabelProps) {
  const { colors } = useTheme();
  const left = align === 'left' ? x : align === 'right' ? x - BOX : x - BOX / 2;
  return (
    <Text
      pointerEvents="none"
      numberOfLines={1}
      style={[styles.label, { left, top: y - 8, textAlign: align, color: colors.textTertiary }]}>
      {text}
    </Text>
  );
}

const styles = StyleSheet.create({
  label: { position: 'absolute', width: BOX, fontSize: 11, lineHeight: 16, fontVariant: ['tabular-nums'] },
});
