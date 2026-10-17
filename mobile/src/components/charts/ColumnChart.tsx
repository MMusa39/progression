/**
 * Single-series column chart for totals per period (e.g. volume per week).
 *
 * Mark specs: columns at most 24px wide with a 4px rounded top, square at the
 * zero baseline. The y axis always starts at zero, because a column's length
 * encodes its value. Empty periods are kept (as gaps), so time isn't compressed.
 * Touching selects the nearest column: it stays solid while the others dim.
 */
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import Svg, { Line, Path, Rect } from 'react-native-svg';

import { useTheme } from '@/theme/useTheme';

import { AxisLabel } from './AxisLabel';
import { ChartReadout } from './ChartReadout';
import { formatCompact, linearScale, niceTicks } from './scale';
import { useChartScrub } from './useChartScrub';

export type Column = { key: string; label: string; tooltipLabel: string; value: number };

type ColumnChartProps = {
  data: Column[];
  height?: number;
  formatValue: (value: number) => string;
  accessibilityLabel: string;
};

const PAD = { top: 60, right: 8, bottom: 26 };
const MAX_BAR = 24;
const RADIUS = 4;
const MAX_X_LABELS = 6;

/** Column path with rounded top corners and a square base. */
function columnPath(x: number, top: number, width: number, bottom: number): string {
  const r = Math.min(RADIUS, width / 2, bottom - top);
  return [
    `M${x},${bottom}`,
    `L${x},${top + r}`,
    `Q${x},${top} ${x + r},${top}`,
    `L${x + width - r},${top}`,
    `Q${x + width},${top} ${x + width},${top + r}`,
    `L${x + width},${bottom}`,
    'Z',
  ].join(' ');
}

export function ColumnChart({ data, height = 220, formatValue, accessibilityLabel }: ColumnChartProps) {
  const { colors } = useTheme();
  const [width, setWidth] = useState(0);

  const ticks = niceTicks(0, Math.max(...data.map((d) => d.value), 0), 3, true);
  const tickLabels = ticks.map(formatCompact);
  const padLeft = Math.max(...tickLabels.map((l) => l.length)) * 6.5 + 12;
  const plotWidth = Math.max(0, width - padLeft - PAD.right);
  const band = plotWidth / Math.max(1, data.length);
  const barWidth = Math.max(2, Math.min(MAX_BAR, band - 2)); // at least the 2px surface gap between neighbors
  const y = linearScale([0, ticks[ticks.length - 1]], [height - PAD.bottom, PAD.top]);
  const baseline = y(0);
  const centers = data.map((_, i) => padLeft + band * i + band / 2);
  const { active, responderProps } = useChartScrub(centers);

  const labelEvery = Math.ceil(data.length / MAX_X_LABELS);

  return (
    <View
      style={{ height }}
      onLayout={(e) => setWidth(e.nativeEvent.layout.width)}
      accessible
      accessibilityRole="image"
      accessibilityLabel={accessibilityLabel}
      accessibilityHint="Touch and drag across the chart to read each period">
      {width > 0 && (
        <Svg width={width} height={height}>
          {ticks.map((tick) => (
            <Line key={`g${tick}`} x1={padLeft} x2={width - PAD.right} y1={y(tick)} y2={y(tick)} stroke={colors.gridline} strokeWidth={1} />
          ))}
          {data.map((d, i) => {
            if (d.value <= 0) return null;
            const top = Math.min(y(d.value), baseline - 1);
            const dimmed = active !== null && active !== i;
            const left = centers[i] - barWidth / 2;
            return top < baseline - RADIUS ? (
              <Path key={d.key} d={columnPath(left, top, barWidth, baseline)} fill={colors.chart} opacity={dimmed ? 0.35 : 1} />
            ) : (
              <Rect key={d.key} x={left} y={top} width={barWidth} height={baseline - top} fill={colors.chart} opacity={dimmed ? 0.35 : 1} />
            );
          })}
        </Svg>
      )}
      {width > 0 && (
        <>
          {ticks.map((tick, i) => (
            <AxisLabel key={`t${tick}`} text={tickLabels[i]} x={padLeft - 8} y={y(tick)} align="right" />
          ))}
          {data.map((d, i) =>
            i % labelEvery === 0 ? <AxisLabel key={`x${d.key}`} text={d.label} x={centers[i]} y={height - 10} align="center" /> : null,
          )}
        </>
      )}
      <View style={StyleSheet.absoluteFill} {...responderProps} />
      {width > 0 && data.length > 0 && (
        <ChartReadout
          left={padLeft}
          selected={active !== null}
          value={formatValue(data[active ?? data.length - 1].value)}
          label={data[active ?? data.length - 1].tooltipLabel}
        />
      )}
    </View>
  );
}
