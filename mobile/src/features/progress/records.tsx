/** Display of personal records: one row per record, used after a workout and in history. */
import { StyleSheet, View } from 'react-native';

import { Icon, Text } from '@/components/ui';
import type { PersonalRecord, RecentRecord, WeightUnit } from '@/features/api/types';
import { formatWeight, kgTo, unitLabel } from '@/features/workout/format';
import { radius, space } from '@/theme/tokens';
import { useTheme } from '@/theme/useTheme';

export function describeRecord(record: PersonalRecord | RecentRecord, unit: WeightUnit): { title: string; detail: string } {
  const weight = (kg: number) => `${formatWeight(Math.round(kgTo(unit, kg) * 10) / 10)} ${unitLabel(unit)}`;
  const set = record.weight != null && record.reps != null && record.weightUnit
    ? `${formatWeight(record.weight)} ${unitLabel(record.weightUnit)} × ${record.reps}`
    : null;
  switch (record.type) {
    case 'ESTIMATED_1RM':
      return {
        title: `Estimated 1RM: ${Math.round(kgTo(unit, record.valueKg))} ${unitLabel(unit)}`,
        detail: `${set ? `${set} · ` : ''}previous best ${Math.round(kgTo(unit, record.previousKg))} ${unitLabel(unit)}`,
      };
    case 'HEAVIEST_WEIGHT':
      return { title: `Heaviest weight: ${set ?? weight(record.valueKg)}`, detail: `previous best ${weight(record.previousKg)}` };
  }
}

/** Records grouped under their exercise, each with a trophy. */
export function PersonalRecordList({ records, unit }: { records: PersonalRecord[]; unit: WeightUnit }) {
  const { colors } = useTheme();
  const byExercise = new Map<string, PersonalRecord[]>();
  records.forEach((r) => byExercise.set(r.exerciseName, [...(byExercise.get(r.exerciseName) ?? []), r]));

  return (
    <View style={{ gap: space.sm }}>
      {[...byExercise.entries()].map(([exercise, list]) => (
        <View key={exercise} style={[styles.group, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <Text variant="headline">{exercise}</Text>
          {list.map((record) => {
            const { title, detail } = describeRecord(record, unit);
            return (
              <View key={record.type} style={styles.row} accessible accessibilityLabel={`New personal record. ${title}. ${detail}`}>
                <View style={[styles.trophy, { backgroundColor: colors.surfaceRaised }]}>
                  <Icon name="trophy" size={16} color="gold" />
                </View>
                <View style={{ flex: 1 }}>
                  <Text variant="subhead" weight="600">
                    {title}
                  </Text>
                  <Text variant="footnote" color="textSecondary">
                    {detail}
                  </Text>
                </View>
              </View>
            );
          })}
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  group: { padding: space.lg, borderRadius: radius.lg, borderWidth: StyleSheet.hairlineWidth, gap: space.md },
  row: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  trophy: { width: 32, height: 32, borderRadius: radius.pill, alignItems: 'center', justifyContent: 'center' },
});
