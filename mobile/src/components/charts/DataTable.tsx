import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { Icon, Text } from '@/components/ui';
import { space } from '@/theme/tokens';
import { useTheme } from '@/theme/useTheme';

type DataTableProps = {
  title?: string;
  columns: [string, string] | [string, string, string];
  rows: { key: string; cells: string[] }[];
  /** Rows shown before "Show all". */
  initialCount?: number;
};

/**
 * The table twin of a chart: every plotted value as plain text, collapsed by
 * default. It's what VoiceOver users read instead of the chart, and it means no
 * value is only reachable by touching the chart.
 */
export function DataTable({ title = 'Show data', columns, rows, initialCount = 6 }: DataTableProps) {
  const { colors } = useTheme();
  const [open, setOpen] = useState(false);
  const [showAll, setShowAll] = useState(false);
  const visible = showAll ? rows : rows.slice(0, initialCount);

  return (
    <View>
      <Pressable
        onPress={() => setOpen((o) => !o)}
        style={styles.toggle}
        accessibilityRole="button"
        accessibilityState={{ expanded: open }}
        hitSlop={8}>
        <Text variant="footnote" weight="600" color="accentText">
          {open ? 'Hide data' : title}
        </Text>
        <Icon name={open ? 'chevron-up' : 'chevron-down'} size={14} color="accentText" />
      </Pressable>
      {open && (
        <View style={{ marginTop: space.sm }}>
          <View style={[styles.row, { borderBottomColor: colors.border }]}>
            {columns.map((column, i) => (
              <Text key={column} variant="caption" color="textTertiary" style={[styles.cell, i > 0 && styles.numeric]}>
                {column.toUpperCase()}
              </Text>
            ))}
          </View>
          {visible.map((row) => (
            <View key={row.key} style={[styles.row, { borderBottomColor: colors.border }]} accessible accessibilityLabel={row.cells.join(', ')}>
              {row.cells.map((cell, i) => (
                <Text key={i} variant="footnote" color={i === 0 ? 'textSecondary' : 'text'} style={[styles.cell, i > 0 && styles.numeric]}>
                  {cell}
                </Text>
              ))}
            </View>
          ))}
          {rows.length > initialCount && (
            <Pressable onPress={() => setShowAll((s) => !s)} style={styles.toggle} hitSlop={8} accessibilityRole="button">
              <Text variant="footnote" weight="600" color="accentText">
                {showAll ? 'Show less' : `Show all ${rows.length}`}
              </Text>
            </Pressable>
          )}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  toggle: { flexDirection: 'row', alignItems: 'center', gap: space.xs, paddingVertical: space.xs, alignSelf: 'flex-start' },
  row: { flexDirection: 'row', paddingVertical: space.xs + 2, borderBottomWidth: StyleSheet.hairlineWidth },
  cell: { flex: 1 },
  numeric: { textAlign: 'right', fontVariant: ['tabular-nums'] },
});
