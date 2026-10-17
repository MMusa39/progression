import Svg, { Circle, Polyline } from 'react-native-svg';

import { linearScale } from './scale';
import { useTheme } from '@/theme/useTheme';

type SparklineProps = { values: number[]; width?: number; height?: number };

/**
 * Tiny trend line for list rows: history in a muted gray, the latest point in
 * the chart color. No axes; the row's text carries the actual numbers.
 */
export function Sparkline({ values, width = 64, height = 28 }: SparklineProps) {
  const { colors } = useTheme();
  if (values.length < 2) return null;
  const pad = 4;
  const x = linearScale([0, values.length - 1], [pad, width - pad]);
  const y = linearScale([Math.min(...values), Math.max(...values)], [height - pad, pad]);
  const points = values.map((v, i) => `${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(' ');
  const last = values.length - 1;
  return (
    <Svg width={width} height={height} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      <Polyline points={points} fill="none" stroke={colors.textTertiary} strokeWidth={1.5} strokeLinejoin="round" strokeLinecap="round" />
      <Circle cx={x(last)} cy={y(values[last])} r={3} fill={colors.chart} />
    </Svg>
  );
}
