/**
 * Single-series bar chart for a value per day or week against a target, e.g.
 * calories eaten per day.
 *
 * Mark specs (from the dataviz guidelines): bars start at zero (a bar's length
 * is its value), 4px rounded data-ends anchored to the baseline, at least a
 * 2px gap between bars, and solid hairline gridlines. The target is a shaded
 * band (or a dashed line for a minimum) with a direct label, not a legend.
 * Bars outside the target turn neutral; that's a secondary cue, since position
 * against the band already shows it and the readout says it in words.
 * Missing values (nothing logged) are gaps with a small tick on the baseline,
 * never zero-height bars that look like "ate nothing".
 */
import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Svg, { Line, Path, Rect } from 'react-native-svg';

import { useTheme } from '@/theme/useTheme';

import { AxisLabel } from './AxisLabel';
import { ChartReadout } from './ChartReadout';
import { linearScale, niceTicks } from './scale';
import { useChartScrub } from './useChartScrub';

export type Bar = {
  key: string;
  value: number | null;
  /** Outside the target. */
  muted?: boolean;
  /** Still accumulating (e.g. today): drawn as an outline. */
  inProgress?: boolean;
};

type BarChartProps = {
  bars: Bar[];
  height?: number;
  /** Target zone; `high` may be Infinity (a minimum), which shades to the top. */
  band?: { low: number; high: number } | null;
  /** Dashed reference line with a direct label, e.g. "Target 2,140". */
  target?: { value: number; label: string } | null;
  formatAxis: (value: number) => string;
  /** Short x label for a bar (first, middle and last are shown). */
  formatX: (index: number) => string;
  /** Readout text for a bar: shown for the touched bar, or `restingIndex` at rest. */
  readout: (index: number) => { value: string; label: string; detail?: string };
  restingIndex: number;
  accessibilityLabel: string;
};

const PAD = { top: 60, right: 8, bottom: 26 };
const RADIUS = 4;
const GAP = 2;

export function BarChart({
  bars,
  height = 220,
  band,
  target,
  formatAxis,
  formatX,
  readout,
  restingIndex,
  accessibilityLabel,
}: BarChartProps) {
  const { colors } = useTheme();
  const [width, setWidth] = useState(0);

  const values = bars.map((b) => b.value ?? 0);
  const reference = [target?.value ?? 0, band && Number.isFinite(band.high) ? band.high : band?.low ?? 0];
  const ticks = niceTicks(0, Math.max(1, ...values, ...reference) * 1.05, 4, true);
  const tickLabels = ticks.map(formatAxis);
  const padLeft = Math.max(...tickLabels.map((l) => l.length)) * 6.5 + 12;
  const plotWidth = Math.max(0, width - padLeft - PAD.right);
  const slot = bars.length > 0 ? plotWidth / bars.length : 0;
  const barWidth = Math.max(2, Math.min(28, slot - GAP));
  const centers = bars.map((_, i) => padLeft + slot * i + slot / 2);
  const y = linearScale([0, ticks[ticks.length - 1]], [height - PAD.bottom, PAD.top]);
  const baseline = y(0);
  const { active, responderProps } = useChartScrub(centers);
  if (bars.length === 0) return null;

  const shown = active ?? restingIndex;
  const text = readout(shown);
  const xLabelIndexes = [...new Set(bars.length > 2 ? [0, Math.floor((bars.length - 1) / 2), bars.length - 1] : [0, bars.length - 1])];

  return (
    <View
      style={{ height }}
      onLayout={(e) => setWidth(e.nativeEvent.layout.width)}
      accessible
      accessibilityRole="image"
      accessibilityLabel={accessibilityLabel}
      accessibilityHint="Touch and drag across the chart to read each bar">
      {width > 0 && (
        <Svg width={width} height={height}>
          {ticks.map((tick) => (
            <Line key={`g${tick}`} x1={padLeft} x2={width - PAD.right} y1={y(tick)} y2={y(tick)} stroke={colors.gridline} strokeWidth={1} />
          ))}
          {band && (
            <Rect
              x={padLeft}
              width={plotWidth}
              y={Number.isFinite(band.high) ? y(band.high) : PAD.top}
              height={y(band.low) - (Number.isFinite(band.high) ? y(band.high) : PAD.top)}
              fill={colors.chartBand}
            />
          )}
          {active !== null && (
            <Rect x={centers[active] - slot / 2} y={PAD.top - 8} width={slot} height={baseline - PAD.top + 8} fill={colors.surfaceRaised} />
          )}
          {bars.map((bar, i) => {
            const x = centers[i] - barWidth / 2;
            if (bar.value === null) {
              return <Line key={bar.key} x1={x} x2={x + barWidth} y1={baseline - 1} y2={baseline - 1} stroke={colors.border} strokeWidth={2} />;
            }
            const top = Math.min(y(bar.value), baseline - 1);
            const color = bar.muted ? colors.chartMuted : colors.chart;
            return (
              <Path
                key={bar.key}
                d={roundedTop(x, top, barWidth, baseline - top)}
                fill={bar.inProgress ? colors.chartWash : color}
                stroke={bar.inProgress ? colors.chart : undefined}
                strokeWidth={bar.inProgress ? 1.5 : 0}
                strokeDasharray={bar.inProgress ? '3 2' : undefined}
              />
            );
          })}
          {target && (
            <Line
              x1={padLeft}
              x2={width - PAD.right}
              y1={y(target.value)}
              y2={y(target.value)}
              stroke={colors.textSecondary}
              strokeWidth={1.5}
              strokeDasharray="5 4"
            />
          )}
        </Svg>
      )}
      {width > 0 && (
        <>
          {ticks.map((tick, i) => (
            <AxisLabel key={`t${tick}`} text={tickLabels[i]} x={padLeft - 8} y={y(tick)} align="right" />
          ))}
          {target && (
            // Pinned to the left edge with a backing, so bars never cover it.
            <Text
              pointerEvents="none"
              style={[styles.targetLabel, { left: padLeft + 4, top: y(target.value) - 19, color: colors.textSecondary, backgroundColor: colors.surface }]}>
              {target.label}
            </Text>
          )}
          {xLabelIndexes.map((index, i) => (
            <AxisLabel
              key={`x${index}`}
              text={formatX(index)}
              x={centers[index]}
              y={height - 10}
              align={bars.length === 1 ? 'center' : i === 0 ? 'left' : index === bars.length - 1 ? 'right' : 'center'}
            />
          ))}
        </>
      )}
      <View style={StyleSheet.absoluteFill} {...responderProps} />
      {width > 0 && (
        <ChartReadout left={padLeft} selected={active !== null} value={text.value} label={text.label} detail={text.detail} resting="" />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  targetLabel: {
    position: 'absolute',
    fontSize: 11,
    lineHeight: 15,
    fontWeight: '600',
    fontVariant: ['tabular-nums'],
    paddingHorizontal: 4,
    borderRadius: 4,
    overflow: 'hidden',
  },
});

/** A bar with 4px rounded top corners and a square base on the baseline. */
function roundedTop(x: number, top: number, w: number, h: number): string {
  const r = Math.min(RADIUS, w / 2, h);
  return `M${x},${top + h} L${x},${top + r} Q${x},${top} ${x + r},${top} L${x + w - r},${top} Q${x + w},${top} ${x + w},${top + r} L${x + w},${top + h} Z`;
}
