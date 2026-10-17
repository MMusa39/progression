/**
 * One lift's progress over the selected range: where you are now and how much
 * it moved, a chart of each session, your all-time records, and the sessions
 * themselves.
 */
import { Stack, router, useLocalSearchParams } from 'expo-router';
import { useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { LineChart } from '@/components/charts';
import { Button, Card, EmptyState, Icon, SegmentedControl, Text } from '@/components/ui';
import { useExerciseProgression, useExerciseStats, useWeightUnit } from '@/features/api/queries';
import type { ExerciseStats, ProgressionPoint, WeightUnit } from '@/features/api/types';
import { axisDate, shortDate } from '@/features/progress/dates';
import { Delta } from '@/features/progress/Delta';
import { change, defaultMetric, metrics, type MetricKey } from '@/features/progress/metrics';
import { RangeFilter } from '@/features/progress/RangeFilter';
import { rangeLabel, rangeStart, useProgressRange } from '@/features/progress/range';
import { formatWeight, kgTo, muscleGroupLabel, unitLabel } from '@/features/workout/format';
import { radius, space } from '@/theme/tokens';
import { useTheme } from '@/theme/useTheme';

const SESSIONS_PREVIEW = 5;

export default function ExerciseProgressScreen() {
  const { exerciseId } = useLocalSearchParams<{ exerciseId: string }>();
  const range = useProgressRange();
  const from = useMemo(() => rangeStart(range), [range]);
  const progression = useExerciseProgression(exerciseId, from);
  // All-time records come from the unscoped list (records are "best ever", not "best this month").
  const allTime = useExerciseStats(null).data?.find((s) => s.exerciseId === exerciseId);
  const unit = useWeightUnit();
  const [chosenMetric, setChosenMetric] = useState<MetricKey | null>(null);

  if (progression.isPending) return <ActivityIndicator style={{ flex: 1 }} />;
  if (progression.isError) {
    return <EmptyState icon="alert-circle-outline" title="Couldn't load this lift" message={progression.error.message} />;
  }

  const data = progression.data;
  // Bodyweight movements (or lifts only ever logged at 0 weight) progress in reps only.
  const bodyweight = defaultMetric(data.equipment, data) === 'reps' || allTime?.heaviestWeightKg === 0;
  const available: MetricKey[] = bodyweight ? ['reps'] : ['e1rm', 'topSet'];
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

      <View style={[styles.sections, progression.isPlaceholderData && { opacity: 0.5 }]}>
        {latest ? (
          <>
            {/* Hero: the single number this screen leads with. */}
            <View style={styles.hero}>
              <Text variant="caption" color="textSecondary">
                {metric.title.toUpperCase()}
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
              {available.length > 1 && (
                <SegmentedControl<MetricKey>
                  accessibilityLabel="Metric"
                  options={available.map((key) => ({ value: key, label: metrics[key].label }))}
                  value={metricKey}
                  onChange={setChosenMetric}
                />
              )}
              <Text variant="footnote" color="textSecondary">
                {metric.description}
              </Text>
              <LineChart
                data={points}
                formatValue={format}
                formatAxis={(v) => (metricKey === 'reps' ? String(Math.round(v)) : formatWeight(Math.round(v)))}
                formatX={axisDate}
                formatDetail={(i) => topSet(data.points[i], unit)}
                restingReadout={false}
                accessibilityLabel={`${metric.title}, ${rangeLabel(range).toLowerCase()}: ${points.length} sessions, from ${format(points[0].y)} to ${format(latest.y)}.`}
              />
            </Card>

            <Sessions points={data.points} unit={unit} />
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
    </ScrollView>
  );
}

/** "185 × 8" (heaviest set of the session), or "12 reps" for bodyweight work. */
function topSet(p: ProgressionPoint, unit: WeightUnit): string {
  return p.topSetWeightKg > 0
    ? `${formatWeight(Math.round(kgTo(unit, p.topSetWeightKg) * 10) / 10)} × ${p.topSetReps}`
    : `${p.bestReps} reps`;
}

/**
 * Every session in the range, newest first: date, top set, and set count.
 * This is also the chart's table view: every plotted session is readable here
 * without touching the chart.
 */
function Sessions({ points, unit }: { points: ProgressionPoint[]; unit: WeightUnit }) {
  const { colors } = useTheme();
  const [showAll, setShowAll] = useState(false);
  const newestFirst = [...points].reverse();
  const visible = showAll ? newestFirst : newestFirst.slice(0, SESSIONS_PREVIEW);

  return (
    <View style={{ gap: space.sm }}>
      <Text variant="title2">Sessions</Text>
      <View style={[styles.panel, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        {visible.map((p, i) => (
          <Pressable
            key={p.workoutId}
            onPress={() => router.push(`/history/${p.workoutId}`)}
            accessibilityRole="button"
            accessibilityLabel={`${shortDate(p.performedAt)}: top set ${topSet(p, unit)}, ${p.setCount} sets`}
            style={({ pressed }) => [
              styles.sessionRow,
              i > 0 && { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border },
              pressed && { backgroundColor: colors.surfaceRaised },
            ]}>
            <Text variant="subhead" color="textSecondary" style={{ flex: 1 }}>
              {shortDate(p.performedAt)}
            </Text>
            <Text variant="number">{topSet(p, unit)}</Text>
            <Text variant="footnote" color="textTertiary" style={styles.setCount}>
              {p.setCount} set{p.setCount === 1 ? '' : 's'}
            </Text>
            <Icon name="chevron-forward" size={14} color="textTertiary" />
          </Pressable>
        ))}
        {newestFirst.length > SESSIONS_PREVIEW && (
          <Pressable
            onPress={() => setShowAll((s) => !s)}
            accessibilityRole="button"
            style={[styles.sessionRow, styles.showAll, { borderTopColor: colors.border }]}>
            <Text variant="footnote" weight="600" color="accentText">
              {showAll ? 'Show fewer' : `Show all ${newestFirst.length}`}
            </Text>
          </Pressable>
        )}
      </View>
    </View>
  );
}

function PersonalRecords({ stats, unit, bodyweight }: { stats: ExerciseStats; unit: WeightUnit; bodyweight: boolean }) {
  const records = bodyweight
    ? [{ label: 'Most reps in a set', value: `${stats.bestReps}`, note: null }]
    : [
        { label: 'Heaviest weight', value: `${formatWeight(Math.round(kgTo(unit, stats.heaviestWeightKg) * 10) / 10)} ${unitLabel(unit)}`, note: null },
        { label: 'Best est. 1RM', value: `${Math.round(kgTo(unit, stats.bestE1rmKg))} ${unitLabel(unit)}`, note: shortDate(stats.bestE1rmAt) },
      ];
  return (
    <View style={{ gap: space.sm }}>
      <Text variant="title2">All-time records</Text>
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
  panel: { borderRadius: radius.lg, borderWidth: StyleSheet.hairlineWidth, overflow: 'hidden' },
  sessionRow: { flexDirection: 'row', alignItems: 'center', gap: space.md, paddingHorizontal: space.lg, paddingVertical: space.md },
  setCount: { width: 44, textAlign: 'right' },
  showAll: { justifyContent: 'center', borderTopWidth: StyleSheet.hairlineWidth },
  records: { flexDirection: 'row', gap: space.sm },
  recordTile: { flex: 1, padding: space.md, borderRadius: radius.md, borderWidth: StyleSheet.hairlineWidth, gap: 2 },
});
