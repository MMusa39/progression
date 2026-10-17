/**
 * One lift's progress over the selected range: a headline number with its
 * change, a line chart (estimated 1RM, top set, volume or reps), all-time
 * personal records, and every session as a table.
 */
import { Stack, router, useLocalSearchParams } from 'expo-router';
import { useMemo, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, View } from 'react-native';

import { DataTable, LineChart } from '@/components/charts';
import { Button, Card, EmptyState, Icon, SegmentedControl, Text } from '@/components/ui';
import { useExerciseProgression, useExerciseStats, useWeightUnit } from '@/features/api/queries';
import type { ExerciseStats, WeightUnit } from '@/features/api/types';
import { axisDate, shortDate } from '@/features/progress/dates';
import { Delta } from '@/features/progress/Delta';
import { change, defaultMetric, metrics, type MetricKey } from '@/features/progress/metrics';
import { RangeFilter } from '@/features/progress/RangeFilter';
import { rangeLabel, rangeStart, useProgressRange } from '@/features/progress/range';
import { formatWeight, kgTo, muscleGroupLabel, unitLabel } from '@/features/workout/format';
import { radius, space } from '@/theme/tokens';
import { useTheme } from '@/theme/useTheme';

export default function ExerciseProgressScreen() {
  const { exerciseId } = useLocalSearchParams<{ exerciseId: string }>();
  const range = useProgressRange();
  const from = useMemo(() => rangeStart(range), [range]);
  const progression = useExerciseProgression(exerciseId, from);
  const allTime = useExerciseStats().data?.find((s) => s.exerciseId === exerciseId);
  const unit = useWeightUnit();
  const [chosenMetric, setChosenMetric] = useState<MetricKey | null>(null);

  if (progression.isPending) return <ActivityIndicator style={{ flex: 1 }} />;
  if (progression.isError) {
    return <EmptyState icon="alert-circle-outline" title="Couldn't load this lift" message={progression.error.message} />;
  }

  const data = progression.data;
  // Bodyweight movements (or lifts only ever logged at 0 weight) progress in reps only.
  const bodyweight = defaultMetric(data.equipment, data) === 'reps' || allTime?.heaviestWeightKg === 0;
  const available: MetricKey[] = bodyweight ? ['reps'] : ['e1rm', 'topSet', 'volume', 'reps'];
  const metricKey = chosenMetric && available.includes(chosenMetric) ? chosenMetric : available[0];
  const metric = metrics[metricKey];

  const points = data.points.map((p) => ({ key: p.workoutId, x: new Date(p.performedAt).getTime(), y: metric.value(p, unit) }));
  const latest = points.at(-1);
  const delta = change(points.map((p) => p.y));
  const format = (v: number) => metric.format(v, unit);

  return (
    <ScrollView contentInsetAdjustmentBehavior="automatic" contentContainerStyle={styles.content}>
      <Stack.Screen options={{ title: data.exerciseName }} />
      <Text variant="footnote" color="textSecondary">
        {muscleGroupLabel[data.muscleGroup]}
      </Text>

      <RangeFilter />

      {available.length > 1 && (
        <SegmentedControl<MetricKey>
          accessibilityLabel="Metric"
          options={available.map((key) => ({ value: key, label: metrics[key].label }))}
          value={metricKey}
          onChange={setChosenMetric}
        />
      )}

      <View style={[styles.sections, progression.isPlaceholderData && { opacity: 0.5 }]}>
        {latest ? (
          <>
            {/* Hero: the single number this screen leads with. */}
            <View style={styles.hero}>
              <Text variant="caption" color="textSecondary">
                {metric.title.toUpperCase()} · LATEST
              </Text>
              <Text style={styles.heroValue} accessibilityRole="header">
                {format(latest.y)}
              </Text>
              {delta ? (
                <Delta
                  value={delta.absolute}
                  text={format(Math.abs(delta.absolute))}
                  percent={delta.percent}
                  context={`since ${shortDate(points[0].x)}`}
                />
              ) : (
                <Text variant="footnote" color="textSecondary">
                  One session in this range. Log more to see a trend.
                </Text>
              )}
            </View>

            <Card>
              <Text variant="headline">{metric.title}</Text>
              <Text variant="footnote" color="textSecondary">
                {metric.description}
              </Text>
              <LineChart
                data={points}
                formatValue={format}
                formatAxis={(v) => (metricKey === 'reps' ? String(Math.round(v)) : formatWeight(Math.round(v)))}
                formatX={axisDate}
                formatDetail={(i) => {
                  const p = data.points[i];
                  return p.topSetWeightKg > 0 ? `${formatWeight(Math.round(kgTo(unit, p.topSetWeightKg) * 10) / 10)} × ${p.topSetReps}` : `${p.bestReps} reps`;
                }}
                accessibilityLabel={`${metric.title}, ${rangeLabel(range).toLowerCase()}: ${points.length} sessions, from ${format(points[0].y)} to ${format(latest.y)}.`}
              />
              <DataTable
                columns={['Date', metric.label, 'Top set']}
                rows={[...data.points].reverse().map((p) => ({
                  key: p.workoutId,
                  cells: [
                    shortDate(p.performedAt),
                    format(metric.value(p, unit)),
                    p.topSetWeightKg > 0 ? `${formatWeight(Math.round(kgTo(unit, p.topSetWeightKg) * 10) / 10)} × ${p.topSetReps}` : `${p.bestReps} reps`,
                  ],
                }))}
              />
            </Card>
          </>
        ) : (
          <Card>
            <EmptyState
              icon="calendar-outline"
              title="No sessions in this range"
              message={`You haven't logged ${data.exerciseName} in the ${rangeLabel(range).toLowerCase()}.`}
              action={
                range.preset !== 'ALL' ? (
                  <Button title="Show all time" variant="secondary" fullWidth={false} onPress={() => range.setPreset('ALL')} />
                ) : undefined
              }
            />
          </Card>
        )}
      </View>

      {allTime && <PersonalRecords stats={allTime} unit={unit} bodyweight={bodyweight} />}

      <Button title="View workout history" variant="ghost" icon="time-outline" onPress={() => router.push('/history')} />
    </ScrollView>
  );
}

function PersonalRecords({ stats, unit, bodyweight }: { stats: ExerciseStats; unit: WeightUnit; bodyweight: boolean }) {
  const records = bodyweight
    ? [{ label: 'Most reps in a set', value: `${stats.bestReps} reps`, note: null }]
    : [
        { label: 'Best est. 1RM', value: `${Math.round(kgTo(unit, stats.bestE1rmKg))} ${unitLabel(unit)}`, note: shortDate(stats.bestE1rmAt) },
        { label: 'Heaviest weight', value: `${formatWeight(Math.round(kgTo(unit, stats.heaviestWeightKg) * 10) / 10)} ${unitLabel(unit)}`, note: null },
        { label: 'Most reps in a set', value: `${stats.bestReps}`, note: null },
      ];
  return (
    <View style={{ gap: space.sm }}>
      <Text variant="title2">Personal records</Text>
      <Text variant="footnote" color="textSecondary">
        All time · {stats.sessions} session{stats.sessions === 1 ? '' : 's'}
      </Text>
      <View style={styles.records}>
        {records.map((r) => (
          <RecordTile key={r.label} {...r} />
        ))}
      </View>
    </View>
  );
}

function RecordTile({ label, value, note }: { label: string; value: string; note: string | null }) {
  const { colors } = useTheme();
  return (
    <View style={[styles.recordTile, { backgroundColor: colors.surface, borderColor: colors.border }]} accessible accessibilityLabel={`${label}: ${value}`}>
      <Icon name="trophy" size={18} color="gold" />
      <Text variant="caption" color="textSecondary">
        {label}
      </Text>
      <Text variant="headline">{value}</Text>
      {note && (
        <Text variant="caption" color="textTertiary">
          {note}
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  content: { padding: space.lg, gap: space.lg, paddingBottom: space.xxxl },
  sections: { gap: space.lg },
  hero: { gap: space.xs },
  // Hero figure: 48pt, the same system sans as the rest of the UI, proportional digits.
  heroValue: { fontSize: 48, lineHeight: 54, fontWeight: '800' },
  records: { flexDirection: 'row', gap: space.sm },
  recordTile: { flex: 1, padding: space.md, borderRadius: radius.md, borderWidth: StyleSheet.hairlineWidth, gap: 2 },
});
