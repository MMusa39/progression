/**
 * Top of the food diary: calories eaten vs. target (with what's left), then
 * protein / carbs / fat bars. Progress bars, not rings: they read faster
 * and line up into an easy comparison.
 */
import { router } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { Card, Icon, Text } from '@/components/ui';
import type { Nutrients, TargetsResponse } from '@/features/api/types';
import { radius, space } from '@/theme/tokens';
import { useTheme } from '@/theme/useTheme';

export function DaySummary({ totals, targets }: { totals: Nutrients; targets: TargetsResponse | null }) {
  const t = targets?.targets;
  const eaten = Math.round(totals.kcal);
  const left = t ? t.calories - eaten : null;

  return (
    <Card onPress={() => router.push('/food/goals')} accessibilityLabel={`${eaten} calories eaten${t ? ` of ${t.calories}` : ''}. Tap for goal details.`}>
      <View style={styles.header}>
        <View style={{ flex: 1 }}>
          <Text variant="caption" color="textSecondary">
            CALORIES
          </Text>
          <Text style={styles.big}>
            {eaten.toLocaleString()}
            {t && (
              <Text variant="title2" color="textTertiary">
                {' '}/ {t.calories.toLocaleString()}
              </Text>
            )}
          </Text>
        </View>
        {left !== null && (
          <View style={styles.left}>
            <Text variant="title2" color={left >= 0 ? 'text' : 'danger'}>
              {Math.abs(left).toLocaleString()}
            </Text>
            <Text variant="caption" color="textSecondary">
              {left >= 0 ? 'left' : 'over'}
            </Text>
          </View>
        )}
        <Icon name="chevron-forward" size={16} color="textTertiary" />
      </View>
      {t && <Bar value={totals.kcal} target={t.calories} />}
      <View style={styles.macros}>
        <Macro label="Protein" value={totals.proteinG} target={t?.proteinG} />
        <Macro label="Carbs" value={totals.carbsG} target={t?.carbsG} />
        <Macro label="Fat" value={totals.fatG} target={t?.fatG} />
      </View>
      {t && (
        <Text variant="caption" color="textTertiary">
          Fiber {Math.round(totals.fiberG)} / {t.fiberG} g
        </Text>
      )}
    </Card>
  );
}

function Macro({ label, value, target }: { label: string; value: number; target?: number }) {
  return (
    <View style={styles.macro} accessible accessibilityLabel={`${label}: ${Math.round(value)} grams${target ? ` of ${target}` : ''}`}>
      <Text variant="caption" color="textSecondary">
        {label}
      </Text>
      <Text variant="headline">
        {Math.round(value)}
        <Text variant="footnote" color="textTertiary">
          {target ? ` / ${target}g` : 'g'}
        </Text>
      </Text>
      {target ? <Bar value={value} target={target} thin /> : null}
    </View>
  );
}

/** Fill shows progress toward a target; going over turns the overflow red so it never reads as "done". */
function Bar({ value, target, thin = false }: { value: number; target: number; thin?: boolean }) {
  const { colors } = useTheme();
  const ratio = target > 0 ? value / target : 0;
  const over = ratio > 1;
  return (
    <View style={[styles.track, thin && styles.thin, { backgroundColor: colors.surfaceRaised }]}>
      <View
        style={[
          styles.fill,
          { width: `${Math.min(100, ratio * 100)}%`, backgroundColor: over ? colors.danger : colors.chart },
        ]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  big: { fontSize: 34, lineHeight: 40, fontWeight: '800' },
  left: { alignItems: 'flex-end' },
  macros: { flexDirection: 'row', gap: space.md, marginTop: space.xs },
  macro: { flex: 1, gap: 2 },
  track: { height: 8, borderRadius: radius.pill, overflow: 'hidden' },
  thin: { height: 5, marginTop: 2 },
  fill: { height: '100%', borderRadius: radius.pill },
});
