/**
 * Progress tab, in three views sharing one time range:
 *
 * Strength: the three questions a lifter actually asks.
 *   1. Am I showing up?        → workouts in the range + weekly streak
 *   2. Did I set any records?  → recent PRs
 *   3. Is each lift improving? → every lift trained in the range, with how much it moved
 *
 * Body: weigh-ins and the smoothed weight trend (see BodyOverview).
 * Nutrition: how consistently you hit calorie and macro targets (see NutritionOverview).
 */
import { useQueryClient } from '@tanstack/react-query';
import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, RefreshControl, ScrollView, StyleSheet, View } from 'react-native';

import { Sparkline } from '@/components/charts';
import { Button, EmptyState, Icon, SegmentedControl, Text } from '@/components/ui';
import { BodyOverview } from '@/features/body/BodyOverview';
import { NutritionOverview } from '@/features/nutrition/NutritionOverview';
import { useExerciseStats, useRecentRecords, useStatsSummary, useWeightUnit } from '@/features/api/queries';
import type { ExerciseStats, RecentRecord, StatsSummary, WeightUnit } from '@/features/api/types';
import { shortDate } from '@/features/progress/dates';
import { Delta } from '@/features/progress/Delta';
import { KpiTile } from '@/features/progress/KpiTile';
import { RangeFilter } from '@/features/progress/RangeFilter';
import { deviceTimeZone, previousPeriodLabel, rangeLabel, rangeStart, useProgressRange, type ProgressView } from '@/features/progress/range';
import { formatWeight, kgTo, unitLabel } from '@/features/workout/format';
import { useStartWorkout } from '@/features/workout/useStartWorkout';
import { radius, space } from '@/theme/tokens';
import { useTheme } from '@/theme/useTheme';

const RECORDS_PREVIEW = 4;

export default function ProgressScreen() {
  const queryClient = useQueryClient();
  const view = useProgressRange((s) => s.view);
  const setView = useProgressRange((s) => s.setView);
  const [refreshing, setRefreshing] = useState(false);

  const refresh = async () => {
    setRefreshing(true);
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ['stats'] }),
      queryClient.invalidateQueries({ queryKey: ['body'] }),
      queryClient.invalidateQueries({ queryKey: ['nutrition'] }),
    ]);
    setRefreshing(false);
  };

  return (
    <ScrollView
      contentInsetAdjustmentBehavior="automatic"
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} />}>
      <SegmentedControl<ProgressView>
        accessibilityLabel="Progress view"
        options={[
          { value: 'strength', label: 'Strength' },
          { value: 'body', label: 'Weight' },
          { value: 'nutrition', label: 'Nutrition' },
        ]}
        value={view}
        onChange={setView}
      />
      <RangeFilter />
      {view === 'strength' ? <StrengthOverview /> : view === 'body' ? <BodyOverview /> : <NutritionOverview />}
    </ScrollView>
  );
}

function StrengthOverview() {
  const range = useProgressRange();
  const from = useMemo(() => rangeStart(range), [range]);
  const summary = useStatsSummary(from, deviceTimeZone());
  const lifts = useExerciseStats(from);
  const records = useRecentRecords(from);
  const allTime = useStatsSummary(null, deviceTimeZone());
  const unit = useWeightUnit();
  const { startEmpty } = useStartWorkout();

  if (summary.isPending || lifts.isPending || records.isPending || allTime.isPending) {
    return <ActivityIndicator style={{ flex: 1 }} />;
  }
  if (summary.isError || lifts.isError) {
    return (
      <EmptyState
        icon="cloud-offline-outline"
        title="Couldn't load your progress"
        message={(summary.error ?? lifts.error)?.message ?? ''}
        action={<Button title="Try again" variant="secondary" fullWidth={false} onPress={() => { summary.refetch(); lifts.refetch(); }} />}
      />
    );
  }

  if ((allTime.data?.workouts ?? 0) === 0) {
    return (
      <EmptyState
        icon="trending-up"
        title="Your progress starts here"
        message="Finish a workout and this screen shows how each lift is improving, your personal records, and your weekly streak."
        action={<Button title="Start a workout" icon="add" fullWidth={false} onPress={startEmpty} />}
      />
    );
  }

  const loadingNewRange = summary.isPlaceholderData || lifts.isPlaceholderData || records.isPlaceholderData;

  return (
    <>
      {/* While a new range loads, keep the previous content on screen, dimmed: no flash, no layout jump. */}
      <View style={[styles.sections, loadingNewRange && { opacity: 0.5 }]}>
        <Consistency summary={summary.data} comparison={previousPeriodLabel(range)} />
        {summary.data.workouts === 0 ? (
          <EmptyState
            icon="calendar-outline"
            title="No workouts in this range"
            message={`Nothing logged in the ${rangeLabel(range).toLowerCase()}.`}
            action={
              range.preset !== 'ALL' ? (
                <Button title="Show all time" variant="secondary" fullWidth={false} onPress={() => range.setPreset('ALL')} />
              ) : undefined
            }
          />
        ) : (
          <>
            <RecentRecords records={records.data ?? []} />
            <Lifts lifts={lifts.data} unit={unit} />
          </>
        )}
      </View>
    </>
  );
}

// ------------------------------------------------------------------ consistency

function Consistency({ summary, comparison }: { summary: StatsSummary; comparison: string | null }) {
  const change =
    summary.previousWorkouts != null
      ? {
          value: summary.workouts - summary.previousWorkouts,
          text: String(Math.abs(summary.workouts - summary.previousWorkouts)),
          percent: null,
        }
      : null;
  return (
    <View style={{ gap: space.xs }}>
      <View style={styles.tiles}>
        <KpiTile label="Workouts" value={String(summary.workouts)} change={change} />
        <KpiTile
          label="Week streak"
          value={summary.currentStreakWeeks > 0 ? `${summary.currentStreakWeeks} ${summary.currentStreakWeeks === 1 ? 'week' : 'weeks'}` : '—'}
        />
      </View>
      {comparison && change && (
        <Text variant="caption" color="textTertiary">
          Workouts {comparison}
          {summary.currentStreakWeeks === 0 ? ' · Train this week to start a streak' : ''}
        </Text>
      )}
    </View>
  );
}

// ------------------------------------------------------------------ recent PRs

/** Records from the same session and lift shown as one row ("260 lb × 6 · heaviest + est. 1RM"). */
type RecordGroup = { key: string; exerciseId: string; exerciseName: string; achievedAt: string; records: RecentRecord[] };

function groupRecords(records: RecentRecord[]): RecordGroup[] {
  const groups = new Map<string, RecordGroup>();
  records.forEach((r) => {
    const key = `${r.workoutId}-${r.exerciseId}`;
    const group = groups.get(key) ?? { key, exerciseId: r.exerciseId, exerciseName: r.exerciseName, achievedAt: r.achievedAt, records: [] };
    group.records.push(r);
    groups.set(key, group);
  });
  return [...groups.values()];
}

/**
 * The record set and what it beat: "260 lb × 6 · new heaviest", or
 * "185 lb × 12 · new best set" when more reps (not more weight) set the record.
 */
function describeGroup(group: RecordGroup): string {
  const heaviest = group.records.find((r) => r.type === 'HEAVIEST_WEIGHT');
  const record = heaviest ?? group.records[0];
  const set = `${formatWeight(record.weight)} ${unitLabel(record.weightUnit)} × ${record.reps}`;
  return `${set} · ${heaviest ? 'new heaviest' : 'new best set'}`;
}

function RecentRecords({ records }: { records: RecentRecord[] }) {
  const { colors } = useTheme();
  const [showAll, setShowAll] = useState(false);
  const groups = groupRecords(records);
  const visible = showAll ? groups : groups.slice(0, RECORDS_PREVIEW);

  return (
    <View style={{ gap: space.sm }}>
      <SectionHeader title="Personal records" subtitle={groups.length > 0 ? `${groups.length} in this range` : undefined} />
      {groups.length === 0 ? (
        <View style={[styles.panel, styles.emptyPanel, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <Icon name="trophy-outline" size={20} color="textTertiary" />
          <Text variant="subhead" color="textSecondary" style={{ flex: 1 }}>
            No new records in this range yet. Beat your best weight or reps on any lift to set one.
          </Text>
        </View>
      ) : (
        <View style={[styles.panel, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          {visible.map((group, i) => {
            const title = describeGroup(group);
            return (
              <Pressable
                key={group.key}
                onPress={() => router.push(`/progress/${group.exerciseId}`)}
                accessibilityRole="button"
                accessibilityLabel={`${group.exerciseName}, personal record: ${title}, ${shortDate(group.achievedAt)}`}
                style={({ pressed }) => [
                  styles.row,
                  i > 0 && { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border },
                  pressed && { backgroundColor: colors.surfaceRaised },
                ]}>
                <View style={[styles.trophy, { backgroundColor: colors.surfaceRaised }]}>
                  <Icon name="trophy" size={16} color="gold" />
                </View>
                <View style={{ flex: 1, gap: 1 }}>
                  <Text variant="subhead" weight="600" numberOfLines={1}>
                    {group.exerciseName}
                  </Text>
                  <Text variant="footnote" color="textSecondary" numberOfLines={1}>
                    {title}
                  </Text>
                </View>
                <Text variant="caption" color="textTertiary">
                  {shortDate(group.achievedAt)}
                </Text>
              </Pressable>
            );
          })}
          {groups.length > RECORDS_PREVIEW && (
            <Pressable
              onPress={() => setShowAll((s) => !s)}
              accessibilityRole="button"
              style={[styles.row, styles.showAll, { borderTopColor: colors.border }]}>
              <Text variant="footnote" weight="600" color="accentText">
                {showAll ? 'Show fewer' : `Show all ${groups.length}`}
              </Text>
            </Pressable>
          )}
        </View>
      )}
    </View>
  );
}

// ------------------------------------------------------------------ lifts

function Lifts({ lifts, unit }: { lifts: ExerciseStats[]; unit: WeightUnit }) {
  const { colors } = useTheme();
  return (
    <View style={{ gap: space.sm }}>
      <SectionHeader title="Your lifts" subtitle="Change in strength over this range. Tap a lift for its chart." />
      <View style={[styles.panel, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        {lifts.map((lift, i) => {
          const bodyweight = lift.equipment === 'BODYWEIGHT' || lift.heaviestWeightKg === 0;
          const series = bodyweight ? lift.rangeBestReps : lift.rangeBestE1rmKg.map((kg) => kgTo(unit, kg));
          const latest = series[series.length - 1];
          const diff = series.length > 1 ? latest - series[0] : null;
          const display = (v: number) => (bodyweight ? `${Math.round(v)} reps` : `${Math.round(v)} ${unitLabel(unit)}`);

          return (
            <Pressable
              key={lift.exerciseId}
              onPress={() => router.push(`/progress/${lift.exerciseId}`)}
              accessibilityRole="button"
              accessibilityLabel={`${lift.exerciseName}. ${bodyweight ? 'Best set' : 'Estimated one rep max'} ${display(latest)}${diff != null ? `, ${diff >= 0 ? 'up' : 'down'} ${display(Math.abs(diff))}` : ''}`}
              style={({ pressed }) => [
                styles.row,
                i > 0 && { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border },
                pressed && { backgroundColor: colors.surfaceRaised },
              ]}>
              <View style={{ flex: 1, gap: 2 }}>
                <Text variant="body" weight="600" numberOfLines={1}>
                  {lift.exerciseName}
                </Text>
                <Text variant="footnote" color="textSecondary" numberOfLines={1}>
                  {bodyweight ? `Best ${display(latest)}` : `Est. 1RM ${display(latest)}`}
                </Text>
              </View>
              <Sparkline values={series} width={52} />
              <View style={styles.change}>
                {diff != null ? (
                  <Delta value={Math.round(diff)} text={display(Math.abs(diff))} compact />
                ) : (
                  <Text variant="caption" color="textTertiary">
                    New
                  </Text>
                )}
              </View>
              <Icon name="chevron-forward" size={16} color="textTertiary" />
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

function SectionHeader({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <View style={{ gap: 2 }}>
      <Text variant="title2">{title}</Text>
      {subtitle && (
        <Text variant="footnote" color="textSecondary">
          {subtitle}
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  content: { padding: space.lg, gap: space.lg, paddingBottom: space.xxxl },
  sections: { gap: space.xl },
  tiles: { flexDirection: 'row', gap: space.sm },
  panel: { borderRadius: radius.lg, borderWidth: StyleSheet.hairlineWidth, overflow: 'hidden' },
  emptyPanel: { flexDirection: 'row', alignItems: 'center', gap: space.md, padding: space.lg },
  row: { flexDirection: 'row', alignItems: 'center', gap: space.md, paddingHorizontal: space.lg, paddingVertical: space.md },
  showAll: { justifyContent: 'center', borderTopWidth: StyleSheet.hairlineWidth },
  trophy: { width: 32, height: 32, borderRadius: radius.pill, alignItems: 'center', justifyContent: 'center' },
  change: { minWidth: 64, alignItems: 'flex-end' },
});
