/**
 * Single-series line chart for a value over time, e.g. estimated 1RM per session.
 *
 * Mark specs (from the dataviz guidelines): 2px line with round joins, ~10%
 * area wash, 8px markers with a 2px surface-colored ring, and solid hairline
 * gridlines. A fixed readout above the plot labels the latest point (or the
 * touched one), instead of a number on every point. The x position is
 * proportional to time, so irregular gaps between sessions look like gaps.
 * The y axis is fitted to the data, not zero-based: for a line, the change is
 * the story, and a zero baseline would flatten it.
 */
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import Svg, { Circle, Line, Path } from 'react-native-svg';

import { useTheme } from '@/theme/useTheme';

import { AxisLabel } from './AxisLabel';
import { ChartReadout } from './ChartReadout';
import { linearScale, niceTicks } from './scale';
import { useChartScrub } from './useChartScrub';

export type LinePoint = { key: string; x: number; y: number };

type LineChartProps = {
  data: LinePoint[];
  height?: number;
  formatValue: (y: number) => string;
  formatAxis?: (y: number) => string;
  formatX: (x: number) => string;
  /** Optional extra tooltip text for a point, e.g. "185 × 5". */
  formatDetail?: (index: number) => string | undefined;
  accessibilityLabel: string;
};

const PAD = { top: 60, right: 14, bottom: 26 };
const MARKER_LIMIT = 24; // beyond this many points, per-point markers turn into clutter

export function LineChart({ data, height = 240, formatValue, formatAxis = formatValue, formatX, formatDetail, accessibilityLabel }: LineChartProps) {
  const { colors } = useTheme();
  const [width, setWidth] = useState(0);

  // Callers render an empty state instead; guard anyway so a chart never crashes a screen.
  const ys = data.length > 0 ? data.map((p) => p.y) : [0];
  const ticks = niceTicks(Math.min(...ys), Math.max(...ys), 4);
  const tickLabels = ticks.map(formatAxis);
  const padLeft = Math.max(...tickLabels.map((l) => l.length)) * 6.5 + 12;

  const x = linearScale([data[0]?.x ?? 0, data[data.length - 1]?.x ?? 0], [padLeft, Math.max(padLeft, width - PAD.right)]);
  const y = linearScale([ticks[0], ticks[ticks.length - 1]], [height - PAD.bottom, PAD.top]);
  const positions = data.map((p) => x(p.x));
  const { active, responderProps } = useChartScrub(positions);
  if (data.length === 0) return null;

  const line = data.map((p, i) => `${i === 0 ? 'M' : 'L'}${x(p.x).toFixed(1)},${y(p.y).toFixed(1)}`).join(' ');
  const baseline = y(ticks[0]);
  const area = `${line} L${positions[positions.length - 1].toFixed(1)},${baseline} L${positions[0].toFixed(1)},${baseline} Z`;
  const last = data[data.length - 1];
  const showAllMarkers = data.length <= MARKER_LIMIT;
  const xLabelIndexes = [...new Set(width > 260 && data.length > 2 ? [0, Math.floor((data.length - 1) / 2), data.length - 1] : [0, data.length - 1])];

  return (
    <View
      style={{ height }}
      onLayout={(e) => setWidth(e.nativeEvent.layout.width)}
      accessible
      accessibilityRole="image"
      accessibilityLabel={accessibilityLabel}
      accessibilityHint="Touch and drag across the chart to read each session">
      {width > 0 && (
        <Svg width={width} height={height}>
          {ticks.map((tick) => (
            <Line key={`g${tick}`} x1={padLeft} x2={width - PAD.right} y1={y(tick)} y2={y(tick)} stroke={colors.gridline} strokeWidth={1} />
          ))}

          <Path d={area} fill={colors.chartWash} />
          <Path d={line} stroke={colors.chart} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" fill="none" />

          {active !== null && (
            <Line x1={positions[active]} x2={positions[active]} y1={PAD.top - 8} y2={baseline} stroke={colors.textTertiary} strokeWidth={1} />
          )}
          {data.map((p, i) =>
            showAllMarkers || i === data.length - 1 || i === active ? (
              <Circle
                key={p.key}
                cx={positions[i]}
                cy={y(p.y)}
                r={i === active ? 6 : 4}
                fill={colors.chart}
                stroke={colors.surface}
                strokeWidth={2}
              />
            ) : null,
          )}
        </Svg>
      )}
      {width > 0 && (
        <>
          {ticks.map((tick, i) => (
            <AxisLabel key={`t${tick}`} text={tickLabels[i]} x={padLeft - 8} y={y(tick)} align="right" />
          ))}
          {xLabelIndexes.map((index, i) => (
            <AxisLabel
              key={`x${index}`}
              text={formatX(data[index].x)}
              x={positions[index]}
              y={height - 10}
              align={data.length === 1 ? 'center' : i === 0 ? 'left' : index === data.length - 1 ? 'right' : 'center'}
            />
          ))}
        </>
      )}
      <View style={StyleSheet.absoluteFill} {...responderProps} />
      {width > 0 && (
        <ChartReadout
          left={padLeft}
          selected={active !== null}
          value={formatValue((active !== null ? data[active] : last).y)}
          label={formatX((active !== null ? data[active] : last).x)}
          detail={formatDetail?.(active ?? data.length - 1)}
        />
      )}
    </View>
  );
}
