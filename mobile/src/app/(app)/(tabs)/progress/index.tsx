/**
 * Progress tab: how training is going over the selected time range.
 *
 *   range filter → headline numbers → streak → volume/workouts/sets chart
 *   → muscle-group split → every lift with its all-time best and trend
 */
import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, RefreshControl, ScrollView, StyleSheet, View } from 'react-native';

import { ColumnChart, DataTable, HorizontalBars, Sparkline, formatCompact } from '@/components/charts';
import { Button, Card, EmptyState, Icon, SegmentedControl, Text } from '@/components/ui';
import { useExerciseStats, useStatsSummary, useWeightUnit } from '@/features/api/queries';
import type { ExerciseStats, StatsSummary, StatsTotals, WeightUnit } from '@/features/api/types';
import { axisDate, parseLocalDate, shortDate } from '@/features/progress/dates';
import { KpiTile } from '@/features/progress/KpiTile';
import { RangeFilter } from '@/features/progress/RangeFilter';
import { deviceTimeZone, previousPeriodLabel, rangeLabel, rangeStart, useProgressRange } from '@/features/progress/range';
import { kgTo, muscleGroupLabel, unitLabel } from '@/features/workout/format';
import { useStartWorkout } from '@/features/workout/useStartWorkout';
import { radius, space } from '@/theme/tokens';
import { useTheme } from '@/theme/useTheme';

type TrendMetric = 'volume' | 'workouts' | 'sets';

export default function ProgressScreen() {
  const range = useProgressRange();
  const from = useMemo(() => rangeStart(range), [range]);
  const summary = useStatsSummary(from, deviceTimeZone());
  const exerciseStats = useExerciseStats();
  const unit = useWeightUnit();
  const { startEmpty } = useStartWorkout();

  if (summary.isPending || exerciseStats.isPending) {
    return <ActivityIndicator style={{ flex: 1 }} />;
  }
  if (summary.isError) {
    return (
      <EmptyState
        icon="cloud-offline-outline"
        title="Couldn't load your progress"
        message={summary.error.message}
        action={<Button title="Try again" variant="secondary" fullWidth={false} onPress={() => summary.refetch()} />}
      />
    );
  }

  const neverTrained = (exerciseStats.data?.length ?? 0) === 0;
  const refreshing = summary.isRefetching && !summary.isPlaceholderData;

  return (
    <ScrollView
      contentInsetAdjustmentBehavior="automatic"
      contentContainerStyle={styles.content}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={() => {
            summary.refetch();
            exerciseStats.refetch();
          }}
        />
      }>
      {neverTrained ? (
        <EmptyState
          icon="trending-up"
          title="Your progress starts here"
          message="Finish your first workout and this screen fills with charts: strength over time, weekly volume, streaks, and personal records."
          action={<Button title="Start a workout" icon="add" fullWidth={false} onPress={startEmpty} />}
        />
      ) : (
        <>
          <RangeFilter />
          {/* While a new range loads, keep the previous charts on screen, dimmed: no flash, no layout jump. */}
          <View style={[styles.sections, summary.isPlaceholderData && { opacity: 0.5 }]}>
            <Headline summary={summary.data} unit={unit} comparison={previousPeriodLabel(range)} />
            <StreakCard weeks={summary.data.currentStreakWeeks} />
            <TrendCard summary={summary.data} unit={unit} rangeText={rangeLabel(range).toLowerCase()} />
            <MuscleSplitCard summary={summary.data} />
          </View>
          <LiftsList stats={exerciseStats.data ?? []} unit={unit} />
        </>
      )}
    </ScrollView>
  );
}

// ------------------------------------------------------------------ headline numbers

function Headline({ summary, unit, comparison }: { summary: StatsSummary; unit: WeightUnit; comparison: string | null }) {
  const { totals, previousTotals } = summary;
  const delta = (pick: (t: StatsTotals) => number, format: (n: number) => string) => {
    if (!previousTotals) return null;
    const diff = pick(totals) - pick(previousTotals);
    const base = pick(previousTotals);
    return { value: diff, text: format(Math.abs(diff)), percent: base > 0 ? (diff / base) * 100 : null };
  };

  return (
    <View style={{ gap: space.xs }}>
      <View style={styles.kpis}>
        <KpiTile label="Workouts" value={String(totals.workouts)} change={delta((t) => t.workouts, String)} />
        <KpiTile
          label={`Volume (${unitLabel(unit)})`}
          value={formatCompact(kgTo(unit, totals.volumeKg))}
          change={delta((t) => kgTo(unit, t.volumeKg), formatCompact)}
        />
        <KpiTile label="Sets" value={String(totals.sets)} change={delta((t) => t.sets, String)} />
      </View>
      {comparison && (
        <Text variant="caption" color="textTertiary">
          Changes {comparison}
        </Text>
      )}
    </View>
  );
}

function StreakCard({ weeks }: { weeks: number }) {
  const { colors } = useTheme();
  return (
    <Card style={styles.streak}>
      <View style={[styles.streakIcon, { backgroundColor: weeks > 0 ? colors.accentMuted : colors.surfaceRaised }]}>
        <Icon name="flame" size={24} color={weeks > 0 ? 'accentText' : 'textTertiary'} />
      </View>
      <View style={{ flex: 1 }}>
        <Text variant="headline">{weeks > 0 ? `${weeks}-week streak` : 'No active streak'}</Text>
        <Text variant="footnote" color="textSecondary">
          {weeks > 0 ? 'Consecutive weeks with at least one workout.' : 'Train this week to start a new streak.'}
        </Text>
      </View>
    </Card>
  );
}

// ------------------------------------------------------------------ trend chart

const trendTitles: Record<TrendMetric, string> = { volume: 'Training volume', workouts: 'Workouts', sets: 'Working sets' };

function TrendCard({ summary, unit, rangeText }: { summary: StatsSummary; unit: WeightUnit; rangeText: string }) {
  const [metric, setMetric] = useState<TrendMetric>('volume');
  const weekly = summary.bucket === 'WEEK';

  const value = (b: StatsSummary['buckets'][number]) =>
    metric === 'volume' ? kgTo(unit, b.volumeKg) : metric === 'workouts' ? b.workouts : b.sets;
  // Values are already in the user's unit (see `value`), so format without converting again.
  const format = (v: number) =>
    metric === 'volume' ? `${Math.round(v).toLocaleString()} ${unitLabel(unit)}` : `${Math.round(v)} ${metric}`;
  const bucketName = (start: string) => {
    const d = parseLocalDate(start);
    return weekly
      ? `Week of ${shortDate(d)}`
      : d.toLocaleDateString(undefined, { month: 'long', year: 'numeric' });
  };
  const columns = summary.buckets.map((b) => ({
    key: b.start,
    label: weekly ? axisDate(parseLocalDate(b.start)) : parseLocalDate(b.start).toLocaleDateString(undefined, { month: 'short' }),
    tooltipLabel: bucketName(b.start),
    value: value(b),
  }));
  const average = columns.reduce((sum, c) => sum + c.value, 0) / Math.max(1, columns.length);

  return (
    <Card>
      <View style={styles.cardHeader}>
        <Text variant="headline">{trendTitles[metric]}</Text>
        <Text variant="footnote" color="textSecondary">
          Per {weekly ? 'week' : 'month'}, {rangeText} · avg {format(average)}
        </Text>
      </View>
      <SegmentedControl<TrendMetric>
        accessibilityLabel="Chart metric"
        options={[
          { value: 'volume', label: 'Volume' },
          { value: 'workouts', label: 'Workouts' },
          { value: 'sets', label: 'Sets' },
        ]}
        value={metric}
        onChange={setMetric}
      />
      <ColumnChart
        data={columns}
        formatValue={format}
        accessibilityLabel={`${trendTitles[metric]} per ${weekly ? 'week' : 'month'}, ${rangeText}. Average ${format(average)}.`}
      />
      <DataTable
        columns={[weekly ? 'Week of' : 'Month', trendTitles[metric]]}
        rows={[...columns].reverse().map((c) => ({ key: c.key, cells: [c.tooltipLabel.replace('Week of ', ''), format(c.value)] }))}
      />
    </Card>
  );
}

/** Sets per muscle group: shows which areas get the most (and least) work. */
function MuscleSplitCard({ summary }: { summary: StatsSummary }) {
  return (
    <Card>
      <View style={styles.cardHeader}>
        <Text variant="headline">Sets by muscle group</Text>
        <Text variant="footnote" color="textSecondary">
          Working sets in this range, warm-ups excluded
        </Text>
      </View>
      {summary.muscleGroups.length === 0 ? (
        <Text variant="subhead" color="textTertiary">
          No sets logged in this range.
        </Text>
      ) : (
        <HorizontalBars
          data={summary.muscleGroups.map((m) => ({ key: m.muscleGroup, label: muscleGroupLabel[m.muscleGroup], value: m.sets }))}
        />
      )}
    </Card>
  );
}

// ------------------------------------------------------------------ lifts list

function LiftsList({ stats, unit }: { stats: ExerciseStats[]; unit: WeightUnit }) {
  const { colors } = useTheme();
  return (
    <View style={{ gap: space.sm }}>
      <View style={styles.cardHeader}>
        <Text variant="title2">Your lifts</Text>
        <Text variant="footnote" color="textSecondary">
          All-time bests and recent trend. Tap a lift for its charts.
        </Text>
      </View>
      <View style={[styles.list, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        {stats.map((s, i) => {
          const bodyweight = s.equipment === 'BODYWEIGHT' || s.heaviestWeightKg === 0;
          return (
            <Pressable
              key={s.exerciseId}
              onPress={() => router.push(`/progress/${s.exerciseId}`)}
              accessibilityRole="button"
              accessibilityLabel={`${s.exerciseName}, ${bodyweight ? `best ${s.bestReps} reps` : `best estimated one rep max ${Math.round(kgTo(unit, s.bestE1rmKg))} ${unitLabel(unit)}`}`}
              style={({ pressed }) => [
                styles.liftRow,
                i > 0 && { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border },
                pressed && { backgroundColor: colors.surfaceRaised },
              ]}>
              <View style={{ flex: 1, gap: 2 }}>
                <Text variant="body" weight="600" numberOfLines={1}>
                  {s.exerciseName}
                </Text>
                <Text variant="footnote" color="textSecondary">
                  {s.sessions} session{s.sessions === 1 ? '' : 's'} · last {shortDate(s.lastPerformedAt)}
                </Text>
              </View>
              {!bodyweight && <Sparkline values={s.recentBestE1rmKg} />}
              <View style={styles.liftBest}>
                <Text variant="headline">{bodyweight ? s.bestReps : Math.round(kgTo(unit, s.bestE1rmKg))}</Text>
                <Text variant="caption" color="textTertiary">
                  {bodyweight ? 'best reps' : `e1RM ${unitLabel(unit)}`}
                </Text>
              </View>
              <Icon name="chevron-forward" size={16} color="textTertiary" />
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  content: { padding: space.lg, gap: space.lg, paddingBottom: space.xxxl },
  sections: { gap: space.lg },
  kpis: { flexDirection: 'row', gap: space.sm },
  streak: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  streakIcon: { width: 44, height: 44, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center' },
  cardHeader: { gap: 2 },
  list: { borderRadius: radius.lg, borderWidth: StyleSheet.hairlineWidth, overflow: 'hidden' },
  liftRow: { flexDirection: 'row', alignItems: 'center', gap: space.md, paddingHorizontal: space.lg, paddingVertical: space.md },
  liftBest: { alignItems: 'flex-end', minWidth: 56 },
});
