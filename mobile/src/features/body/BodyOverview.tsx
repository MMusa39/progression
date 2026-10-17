/**
 * Body-weight progress: the smoothed trend (the number that matters), how
 * fast it's moving, progress toward the goal, and a chart with the daily
 * weigh-ins as faint dots behind the trend line.
 */
import { router } from 'expo-router';
import { useMemo } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';

import { LineChart } from '@/components/charts';
import { Button, Card, EmptyState, Icon, Text } from '@/components/ui';
import { useWeightUnit } from '@/features/api/queries';
import type { WeightUnit } from '@/features/api/types';
import { useTargets } from '@/features/nutrition/queries';
import { axisDate, shortDate } from '@/features/progress/dates';
import { Delta } from '@/features/progress/Delta';
import { rangeLabel, rangeStart, useProgressRange } from '@/features/progress/range';
import { formatWeight, kgTo, unitLabel } from '@/features/workout/format';
import { localDate } from '@/lib/dates';
import { radius, space } from '@/theme/tokens';
import { useTheme } from '@/theme/useTheme';

import { useBodyWeights } from './queries';

const RECENT_COUNT = 7;

export function BodyOverview() {
  const { colors } = useTheme();
  const range = useProgressRange();
  const from = useMemo(() => {
    const start = rangeStart(range);
    return start ? localDate(start) : null;
  }, [range]);
  const history = useBodyWeights(from);
  const targets = useTargets();
  const unit = useWeightUnit();

  if (history.isPending) return <ActivityIndicator style={{ marginTop: space.xxl }} />;
  if (history.isError) return <EmptyState icon="cloud-offline-outline" title="Couldn't load your weight" message={history.error.message} />;

  const data = history.data;
  if (data.currentTrendKg === null) {
    return (
      <EmptyState
        icon="scale-outline"
        title="Track your body weight"
        message="Weigh in a few times a week, ideally in the morning. Progression smooths out daily water swings and shows the real trend."
        action={<Button title="Log weight" icon="add" fullWidth={false} onPress={() => router.push('/weigh-in')} />}
      />
    );
  }

  const w = (kg: number) => kgTo(unit, kg);
  const fmt = (kg: number) => `${formatWeight(Math.round(w(kg) * 10) / 10)} ${unitLabel(unit)}`;
  const goal = targets.data?.targets.goal;
  const good = goal === 'LOSE' ? 'down' : goal === 'GAIN' ? 'up' : 'none';
  const entries = data.entries;
  const trendPoints = entries.map((e) => ({ key: e.date, x: dateMs(e.date), y: w(e.trendKg) }));
  const dots = entries.map((e) => ({ x: dateMs(e.date), y: w(e.weightKg) }));

  return (
    <View style={[styles.sections, history.isPlaceholderData && { opacity: 0.5 }]}>
      <View style={styles.hero}>
        <Text variant="caption" color="textSecondary">
          TREND WEIGHT
        </Text>
        <Text style={styles.heroValue}>{fmt(data.currentTrendKg)}</Text>
        {data.changeInRangeKg !== null && entries.length > 1 ? (
          <Delta
            value={data.changeInRangeKg}
            text={fmt(Math.abs(data.changeInRangeKg))}
            context={`since ${shortDate(dateMs(entries[0].date))}`}
            good={good}
          />
        ) : null}
        {data.weeklyChangeKg !== null && (
          <Text variant="footnote" color="textSecondary">
            {rate(data.weeklyChangeKg, unit)} over the last two weeks
          </Text>
        )}
      </View>

      {targets.data && <GoalCard targets={targets.data} unit={unit} fmt={fmt} />}

      {trendPoints.length > 0 ? (
        <Card>
          <View style={styles.legend} accessibilityElementsHidden>
            <View style={styles.legendItem}>
              <View style={[styles.legendDot, { backgroundColor: colors.textTertiary }]} />
              <Text variant="caption" color="textSecondary">Weigh-ins</Text>
            </View>
            <View style={styles.legendItem}>
              <View style={[styles.legendLine, { backgroundColor: colors.chart }]} />
              <Text variant="caption" color="textSecondary">Trend</Text>
            </View>
          </View>
          <LineChart
            data={trendPoints}
            dots={dots}
            formatValue={(v) => `${formatWeight(Math.round(v * 10) / 10)} ${unitLabel(unit)}`}
            formatAxis={(v) => formatWeight(Math.round(v))}
            formatX={axisDate}
            formatDetail={(i) => `scale ${fmt(entries[i].weightKg)}`}
            accessibilityLabel={`Weight trend, ${rangeLabel(range).toLowerCase()}: from ${fmt(entries[0].trendKg)} to ${fmt(entries[entries.length - 1].trendKg)}.`}
          />
        </Card>
      ) : (
        <Text variant="subhead" color="textSecondary">
          No weigh-ins in the {rangeLabel(range).toLowerCase()}.
        </Text>
      )}

      <Button title="Log weight" icon="add" onPress={() => router.push('/weigh-in')} />

      {entries.length > 0 && (
        <View style={{ gap: space.sm }}>
          <Text variant="title2">Weigh-ins</Text>
          <View style={[styles.panel, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            {[...entries].reverse().slice(0, RECENT_COUNT).map((e, i) => (
              <Pressable
                key={e.date}
                onPress={() => router.push({ pathname: '/weigh-in', params: { date: e.date } })}
                accessibilityRole="button"
                accessibilityLabel={`${shortDate(dateMs(e.date))}: ${formatWeight(e.weight)} ${unitLabel(e.weightUnit)}. Tap to edit.`}
                style={({ pressed }) => [
                  styles.row,
                  i > 0 && { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border },
                  pressed && { backgroundColor: colors.surfaceRaised },
                ]}>
                <Text variant="subhead" color="textSecondary" style={{ flex: 1 }}>
                  {shortDate(dateMs(e.date))}
                </Text>
                <Text variant="number">{formatWeight(e.weight)} {unitLabel(e.weightUnit)}</Text>
                <Text variant="footnote" color="textTertiary" style={styles.trendCell}>
                  trend {formatWeight(Math.round(w(e.trendKg) * 10) / 10)}
                </Text>
              </Pressable>
            ))}
          </View>
        </View>
      )}
    </View>
  );
}

function GoalCard({ targets, unit, fmt }: {
  targets: NonNullable<ReturnType<typeof useTargets>['data']>;
  unit: WeightUnit;
  fmt: (kg: number) => string;
}) {
  const t = targets.targets;
  const toGo = targets.goalWeightKg - targets.currentWeightKg;
  return (
    <Card onPress={() => router.push('/food/plan')} accessibilityLabel="Weight goal. Tap to edit.">
      <View style={styles.goalHeader}>
        <Icon name="flag-outline" size={18} color="accentText" />
        <Text variant="headline" style={{ flex: 1 }}>
          Goal: {fmt(targets.goalWeightKg)}
        </Text>
        <Icon name="chevron-forward" size={16} color="textTertiary" />
      </View>
      <Text variant="subhead" color="textSecondary">
        {t.goal === 'MAINTAIN'
          ? "You're at your goal. Targets are set to maintain."
          : `${fmt(Math.abs(toGo))} to go${t.projectedGoalDate ? ` · on pace for ${shortDate(t.projectedGoalDate)}` : ''}`}
      </Text>
      {t.rateCapped && t.goal !== 'MAINTAIN' && (
        <Text variant="footnote" color="textTertiary">
          Your timeline was faster than a safe pace ({rate(t.weeklyRateKg, unit)}), so the plan uses the safe pace instead.
        </Text>
      )}
    </Card>
  );
}

function rate(kgPerWeek: number, unit: WeightUnit): string {
  const v = kgTo(unit, kgPerWeek);
  const sign = v > 0.005 ? '+' : v < -0.005 ? '−' : '±';
  return `${sign}${formatWeight(Math.round(Math.abs(v) * 10) / 10)} ${unitLabel(unit)}/week`;
}

function dateMs(isoDate: string): number {
  const [y, m, d] = isoDate.split('-').map(Number);
  return new Date(y, m - 1, d).getTime();
}

const styles = StyleSheet.create({
  sections: { gap: space.lg },
  hero: { gap: space.xs },
  heroValue: { fontSize: 48, lineHeight: 54, fontWeight: '800' },
  legend: { flexDirection: 'row', gap: space.lg },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: space.xs },
  legendDot: { width: 6, height: 6, borderRadius: 3 },
  legendLine: { width: 14, height: 2, borderRadius: 1 },
  goalHeader: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  panel: { borderRadius: radius.lg, borderWidth: StyleSheet.hairlineWidth, overflow: 'hidden' },
  row: { flexDirection: 'row', alignItems: 'center', gap: space.md, paddingHorizontal: space.lg, paddingVertical: space.md },
  trendCell: { width: 88, textAlign: 'right' },
});
