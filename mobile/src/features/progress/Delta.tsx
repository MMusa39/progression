import { StyleSheet, View } from 'react-native';

import { Icon, Text } from '@/components/ui';
import { space } from '@/theme/tokens';

type DeltaProps = {
  /** Signed change; positive = improvement for every metric we show. */
  value: number;
  /** Already-formatted magnitude, e.g. "15 lb" or "3 workouts". */
  text: string;
  percent?: number | null;
  /** Comparison context, e.g. "vs previous 4 weeks" or "since Aug 2". */
  context?: string | null;
  /** Tile mode: arrow + percentage only (or the amount when there's no percentage), on one line. */
  compact?: boolean;
};

/**
 * Signed change with an arrow, e.g. "▲ 15 lb (+7%) since Aug 2". Direction is
 * shown by the arrow and the sign as well as the color, so it never relies on
 * color alone. Here, up is always good (more strength, more training).
 */
export function Delta({ value, text, percent, context, compact = false }: DeltaProps) {
  const direction = value > 0 ? 'up' : value < 0 ? 'down' : 'flat';
  const color = direction === 'up' ? 'accentText' : direction === 'down' ? 'danger' : 'textSecondary';
  const icon = direction === 'up' ? 'arrow-up' : direction === 'down' ? 'arrow-down' : 'remove';
  const sign = direction === 'up' ? '+' : direction === 'down' ? '−' : '±';
  const pct = percent != null && Number.isFinite(percent) ? ` (${sign}${Math.abs(Math.round(percent))}%)` : '';

  return (
    <View style={styles.row} accessible accessibilityLabel={`${direction === 'flat' ? 'No change' : `${direction} ${text}`}${pct} ${context ?? ''}`}>
      <Icon name={icon} size={13} color={color} />
      <Text variant="footnote" weight="600" color={color} numberOfLines={1}>
        {compact && percent != null && Number.isFinite(percent)
          ? `${sign}${Math.abs(Math.round(percent))}%`
          : `${sign}${text}${pct}`}
      </Text>
      {context ? (
        <Text variant="footnote" color="textTertiary">
          {context}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: space.xs, flexWrap: 'wrap' },
});
