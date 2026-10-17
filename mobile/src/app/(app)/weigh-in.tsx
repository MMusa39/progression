/**
 * Log (or edit) a weigh-in. Opens with today's date unless a date is passed,
 * pre-filled with that day's weight or the latest one.
 */
import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Alert, StyleSheet, TextInput, View } from 'react-native';

import { Button, Screen, SegmentedControl, Text } from '@/components/ui';
import { useWeightUnit } from '@/features/api/queries';
import { useBodyWeights, useDeleteWeight, useLogWeight } from '@/features/body/queries';
import { formatWeight, kgTo, unitLabel } from '@/features/workout/format';
import { addDays, dayLabel, localDate } from '@/lib/dates';
import { radius, space } from '@/theme/tokens';
import { useTheme } from '@/theme/useTheme';

/** Back to where the user came from, or to Progress when opened directly (e.g. from a link). */
const close = () => (router.canGoBack() ? router.back() : router.replace('/progress'));

export default function WeighInScreen() {
  const { colors } = useTheme();
  const params = useLocalSearchParams<{ date?: string }>();
  const today = localDate();
  const [date, setDate] = useState(params.date ?? today);
  const unit = useWeightUnit();
  const all = useBodyWeights(null);
  const log = useLogWeight();
  const remove = useDeleteWeight();

  const existing = all.data?.entries.find((e) => e.date === date);
  const latest = all.data?.entries.at(-1);
  const initial = existing
    ? formatWeight(existing.weight)
    : latest
      ? formatWeight(Math.round(kgTo(unit, latest.weightKg) * 10) / 10)
      : '';
  const [text, setText] = useState<string | null>(null);
  const value = text ?? initial;
  const weight = Number(value.replace(',', '.'));
  const valid = value !== '' && weight >= 20 && weight <= 1400;

  const save = () =>
    log.mutate(
      { date, weight, unit: existing && text === null ? existing.weightUnit : unit },
      { onSuccess: close, onError: (e) => Alert.alert("Couldn't save", e.message) },
    );

  return (
    <Screen
      footer={
        <>
          <Button title="Save" onPress={save} disabled={!valid} loading={log.isPending} />
          {existing && (
            <Button
              title="Delete weigh-in"
              variant="ghost"
              onPress={() => remove.mutate(date, { onSuccess: close })}
              loading={remove.isPending}
            />
          )}
        </>
      }>
      <Text variant="largeTitle" style={{ marginTop: space.xl }}>
        {existing ? 'Edit weigh-in' : 'Log weight'}
      </Text>
      {!params.date && (
        <SegmentedControl<string>
          accessibilityLabel="Day"
          options={[
            { value: today, label: 'Today' },
            { value: addDays(today, -1), label: 'Yesterday' },
          ]}
          value={date}
          onChange={(d) => {
            setDate(d);
            setText(null);
          }}
        />
      )}
      {params.date && (
        <Text variant="callout" color="textSecondary">
          {dayLabel(date)}
        </Text>
      )}
      <View style={[styles.inputRow, { backgroundColor: colors.inputBackground, borderColor: colors.border }]}>
        <TextInput
          value={value}
          onChangeText={(t) => setText(t.replace(/[^0-9.,]/g, ''))}
          keyboardType="decimal-pad"
          autoFocus
          selectTextOnFocus
          accessibilityLabel={`Weight in ${unitLabel(unit)}`}
          selectionColor={colors.accentText}
          style={[styles.input, { color: colors.text }]}
        />
        <Text variant="title2" color="textSecondary">
          {existing && text === null ? unitLabel(existing.weightUnit) : unitLabel(unit)}
        </Text>
      </View>
      <Text variant="footnote" color="textTertiary">
        For the most consistent trend, weigh in first thing in the morning, after the bathroom and before eating.
      </Text>
    </Screen>
  );
}

const styles = StyleSheet.create({
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    borderWidth: 1.5,
    borderRadius: radius.lg,
    paddingHorizontal: space.xl,
    paddingVertical: space.lg,
  },
  input: { flex: 1, minWidth: 0, fontSize: 48, fontWeight: '800' },
});
