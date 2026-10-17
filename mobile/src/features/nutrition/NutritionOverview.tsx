/**
 * Nutrition progress: how consistently you hit your calorie and macro targets.
 *
 *   1. How often am I on target?  → "18 of 24 days" for the chosen metric
 *   2. What does that look like?  → a bar per day (or week) against the target band
 *   3. Am I logging consistently? → logging streak and days logged
 *   4. Week by week               → a table of weekly averages (the chart's data, readable without touch)
 */
import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';

import { BarChart } from '@/components/charts';
import { Button, Card, EmptyState, Icon, SegmentedControl, Text } from '@/components/ui';
import type { NutritionTrends } from '@/features/api/types';
import { axisDate, parseLocalDate, shortDate } from '@/features/progress/dates';
import { rangeStart, useProgressRange } from '@/features/progress/range';
import { addDays, localDate } from '@/lib/dates';
import { space } from '@/theme/tokens';
import { useTheme } from '@/theme/useTheme';

import { useNutritionTrends } from './queries';
import { isOnTarget, METRICS, onTargetCount, targetZone, trendBars, weeklyRows, type MetricKey, type TrendBar } from './trends';

export function NutritionOverview() {
  const range = useProgressRange();
  const from = useMemo(() => {
    const start = rangeStart(range);
    return start ? localDate(start) : null;
  }, [range]);
  const trends = useNutritionTrends(from);
  const [metric, setMetric] = useState<MetricKey>('calories');
  const today = localDate();

  if (trends.isPending) return <ActivityIndicator style={{ marginTop: space.xxl }} />;
  if (trends.isError) return <EmptyState icon="cloud-offline-outline" title="Couldn't load your nutrition" message={trends.error.message} />;

  const data = trends.data;
  if (!data.days.some((d) => d.intake)) {
    return (
      <EmptyState
        icon="nutrition-outline"
        title="No food logged in this range"
        message="Log what you eat on the Food tab, and this shows how consistently you hit your calories and macros."
        action={<Button title="Go to Food" fullWidth={false} onPress={() => router.navigate('/food')} />}
      />
    );
  }

  return (
    <View style={[styles.sections, trends.isPlaceholderData && { opacity: 0.5 }]}>
      <SegmentedControl<MetricKey>
        accessibilityLabel="Nutrient"
        options={(Object.keys(METRICS) as MetricKey[]).map((key) => ({ value: key, label: METRICS[key].label }))}
        value={metric}
        onChange={setMetric}
      />
      <Headline data={data} metric={metric} />
      <Card style={{ paddingHorizontal: space.md }}>
        <MetricChart data={data} metric={metric} today={today} />
      </Card>
      <Consistency data={data} />
      {!data.goals && (
        <Card onPress={() => router.push('/food/plan')} style={styles.prompt} accessibilityLabel="Set up your plan">
          <Icon name="flag-outline" size={22} color="accentText" />
          <Text variant="subhead" style={{ flex: 1 }}>
            Set up your plan to see how often you hit your targets.
          </Text>
          <Icon name="chevron-forward" size={16} color="textTertiary" />
        </Card>
      )}
      <WeeklyTable data={data} today={today} />
      {data.goals && (
        <Text variant="caption" color="textTertiary">
          On target: calories within ±{pct(data.rules.calorieTolerance)}, protein at least {pct(data.rules.proteinMinimum)} of
          your target, carbs and fat within ±{pct(data.rules.macroTolerance)}. Measured against your current targets, over days
          you logged. Today counts once it&apos;s over.
        </Text>
      )}
    </View>
  );
}

/** The answer first: how many logged days hit this target. */
function Headline({ data, metric }: { data: NutritionTrends; metric: MetricKey }) {
  const m = METRICS[metric];
  const hits = onTargetCount(data, metric);
  const logged = data.summary.loggedDays;
  const average = data.summary.average ? m.value(data.summary.average) : null;
  const target = data.goals ? m.goal(data.goals) : null;

  return (
    <View style={{ gap: 2 }}>
      <Text variant="caption" color="textSecondary">
        {hits !== null ? `${m.label.toUpperCase()} ON TARGET` : `AVERAGE ${m.label.toUpperCase()}`}
      </Text>
      {hits !== null ? (
        <Text style={styles.hero}>
          {hits}
          <Text variant="title2" color="textSecondary">
            {' '}
            of {logged} day{logged === 1 ? '' : 's'}
          </Text>
        </Text>
      ) : (
        <Text style={styles.hero}>{average !== null ? `${format(average)} ${m.unit}` : '—'}</Text>
      )}
      {average !== null && target !== null && (
        <Text variant="subhead" color="textSecondary">
          Average {format(average)} {m.unit} a day · target {format(target)}
          {m.kind === 'minimum' ? '+' : ''}
        </Text>
      )}
    </View>
  );
}

function MetricChart({ data, metric, today }: { data: NutritionTrends; metric: MetricKey; today: string }) {
  const m = METRICS[metric];
  const bars = trendBars(data, metric, today);
  const weekly = bars.length > 0 && bars[0].start !== bars[0].end;
  const zone = data.goals ? targetZone(metric, data.goals, data.rules) : null;
  const judge = (bar: TrendBar) =>
    zone && bar.value !== null && !bar.inProgress ? isOnTarget(metric, bar.value, data.goals!, data.rules) : null;

  const lastFinished = bars.findLastIndex((b) => b.value !== null && !b.inProgress);
  const restingIndex = lastFinished >= 0 ? lastFinished : bars.length - 1;

  const describe = (bar: TrendBar): string | undefined => {
    if (bar.value === null) return weekly ? 'Nothing logged' : 'Not logged';
    if (bar.inProgress) return 'So far today';
    if (weekly) return `${bar.loggedDays} day${bar.loggedDays === 1 ? '' : 's'} logged`;
    if (!zone) return undefined;
    if (bar.value < zone.low) return `${format(zone.target - bar.value)} ${m.unit} ${m.kind === 'minimum' ? 'short' : 'under'}`;
    if (bar.value > zone.high) return `${format(bar.value - zone.target)} ${m.unit} over`;
    return m.kind === 'minimum' ? 'Goal hit' : 'On target';
  };

  return (
    <BarChart
      bars={bars.map((bar) => ({ key: bar.key, value: bar.value, inProgress: bar.inProgress, muted: judge(bar) === false }))}
      band={zone ? { low: zone.low, high: zone.high } : null}
      target={zone ? { value: zone.target, label: `Target ${format(zone.target)}` } : null}
      formatAxis={(v) => (v >= 1000 ? `${(v / 1000).toLocaleString(undefined, { maximumFractionDigits: 1 })}k` : String(Math.round(v)))}
      formatX={(i) => axisDate(bars[i].start)}
      restingIndex={restingIndex}
      readout={(i) => {
        const bar = bars[i];
        return {
          value: bar.value === null ? '—' : `${weekly ? 'Avg ' : ''}${format(bar.value)} ${m.unit}`,
          label: weekly ? `Week of ${shortDate(bar.start)}` : dayName(bar.start),
          detail: describe(bar),
        };
      }}
      accessibilityLabel={`${m.label} per ${weekly ? 'week' : 'day'}${zone ? `, target ${format(zone.target)} ${m.unit}` : ''}`}
    />
  );
}

function Consistency({ data }: { data: NutritionTrends }) {
  const { streak, logged, finished } = {
    streak: data.summary.loggingStreak,
    logged: data.summary.loggedDays,
    finished: data.summary.finishedDays,
  };
  return (
    <View style={styles.tiles}>
      <Card style={styles.tile}>
        <Text variant="caption" color="textSecondary">
          LOGGING STREAK
        </Text>
        <View style={styles.tileValue}>
          <Icon name="flame" size={20} color={streak > 0 ? 'gold' : 'textTertiary'} />
          <Text variant="title2">
            {streak} day{streak === 1 ? '' : 's'}
          </Text>
        </View>
      </Card>
      <Card style={styles.tile}>
        <Text variant="caption" color="textSecondary">
          DAYS LOGGED
        </Text>
        <Text variant="title2">
          {logged}
          <Text variant="subhead" color="textSecondary">
            {' '}
            of {finished}
          </Text>
        </Text>
      </Card>
    </View>
  );
}

/** Weekly averages: the chart's numbers in a form you can read without touching it. */
function WeeklyTable({ data, today }: { data: NutritionTrends; today: string }) {
  const { colors } = useTheme();
  const rows = weeklyRows(data, today).filter((r) => r.loggedDays > 0);
  if (rows.length === 0) return null;
  return (
    <View style={{ gap: space.sm }}>
      <Text variant="footnote" weight="600" color="textSecondary">
        WEEKLY AVERAGES
      </Text>
      <Card style={{ padding: 0, gap: 0 }}>
        <View style={[styles.tableRow, { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border }]}>
          <Cell text="Week of" header flex={1.3} />
          <Cell text="Calories" header />
          <Cell text="Protein" header />
          <Cell text={data.goals ? 'On target' : 'Logged'} header />
        </View>
        {rows.map((row, i) => (
          <View key={row.start} style={[styles.tableRow, i > 0 && { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border }]}>
            <Cell text={shortDate(row.start)} flex={1.3} />
            <Cell text={row.kcal !== null ? format(row.kcal) : '—'} />
            <Cell text={row.proteinG !== null ? `${format(row.proteinG)} g` : '—'} />
            <Cell text={data.goals ? `${row.caloriesOnTarget}/${row.loggedDays}` : `${row.loggedDays}/7`} />
          </View>
        ))}
      </Card>
      {data.goals && (
        <Text variant="caption" color="textTertiary">
          On target = days with calories on target, out of days logged that week.
        </Text>
      )}
    </View>
  );
}

function Cell({ text, header, flex = 1 }: { text: string; header?: boolean; flex?: number }) {
  return (
    <Text
      variant={header ? 'caption' : 'subhead'}
      color={header ? 'textSecondary' : 'text'}
      style={{ flex, fontVariant: ['tabular-nums'] }}
      numberOfLines={1}>
      {text}
    </Text>
  );
}

const format = (n: number) => Math.round(n).toLocaleString();
const pct = (fraction: number) => `${Math.round(fraction * 100)}%`;

/** "Today", "Yesterday", or "Tue, Oct 14". */
function dayName(iso: string): string {
  const today = localDate();
  if (iso === today) return 'Today';
  if (iso === addDays(today, -1)) return 'Yesterday';
  return parseLocalDate(iso).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });
}

const styles = StyleSheet.create({
  sections: { gap: space.lg },
  hero: { fontSize: 44, lineHeight: 50, fontWeight: '800' },
  tiles: { flexDirection: 'row', gap: space.md },
  tile: { flex: 1, gap: space.xs },
  tileValue: { flexDirection: 'row', alignItems: 'center', gap: space.xs },
  prompt: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  tableRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: space.lg, paddingVertical: space.sm + 2 },
});
