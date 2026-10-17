import { StyleSheet, View } from 'react-native';

import { space } from '@/theme/tokens';
import { useTheme } from '@/theme/useTheme';

import { Text } from './Text';

/** Horizontal rule, optionally with a centered label ("or"). */
export function Divider({ label }: { label?: string }) {
  const { colors } = useTheme();
  const line = <View style={[styles.line, { backgroundColor: colors.border }]} />;
  if (!label) return line;
  return (
    <View style={styles.row}>
      {line}
      <Text variant="footnote" color="textTertiary">
        {label}
      </Text>
      {line}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  line: { flex: 1, height: StyleSheet.hairlineWidth },
});
