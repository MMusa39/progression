/**
 * Set up or edit the plan: a short form (sex, birth year, height, current and
 * goal weight, timeline, activity) that drives calorie and macro targets, or
 * your own macros instead. The results are shown on My Plan.
 */
import { router, Stack } from 'expo-router';
import { useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Switch, TextInput, View } from 'react-native';

import { Button, Card, Icon, SegmentedControl, Text } from '@/components/ui';
import { useWeightUnit } from '@/features/api/queries';
import type { ActivityLevel, CustomMacros, NutritionProfile, Sex, WeightUnit } from '@/features/api/types';
import { useBodyWeights } from '@/features/body/queries';
import { ACTIVITY, CM_PER_IN } from '@/features/nutrition/activity';
import { useNutritionProfile, useSaveProfile, useTargets } from '@/features/nutrition/queries';
import { parseLocalDate, shortDate } from '@/features/progress/dates';
import { kgTo, unitLabel } from '@/features/workout/format';
import { addDays, localDate } from '@/lib/dates';
import { hitTarget, radius, space, typography } from '@/theme/tokens';
import { useTheme } from '@/theme/useTheme';

export default function EditPlanScreen() {
  const profile = useNutritionProfile();
  const targets = useTargets();
  const weights = useBodyWeights(null);
  const unit = useWeightUnit();

  if (profile.isPending || weights.isPending || targets.isPending) return <ActivityIndicator style={{ flex: 1 }} />;
  const t = targets.data?.targets;

  return (
    <ScrollView contentInsetAdjustmentBehavior="automatic" contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
      <Stack.Screen options={{ title: profile.data ? 'Edit Plan' : 'Set Up Plan' }} />
      <GoalForm
        // Re-mount with fresh defaults once data arrives.
        key={profile.data ? 'edit' : 'new'}
        profile={profile.data ?? null}
        currentKg={weights.data?.currentTrendKg ?? null}
        suggestedMacros={t ? { proteinG: t.proteinG, carbsG: t.carbsG, fatG: t.fatG } : null}
        unit={unit}
      />
      <Text variant="caption" color="textTertiary" align="center">
        Targets are estimates based on standard formulas, not medical advice. If you have a health condition, are
        pregnant, or have a history of disordered eating, check with a professional first.
      </Text>
    </ScrollView>
  );
}

function GoalForm({
  profile,
  currentKg,
  suggestedMacros,
  unit,
}: {
  profile: NutritionProfile | null;
  currentKg: number | null;
  /** Today's calculated macros: the starting point when switching to your own. */
  suggestedMacros: CustomMacros | null;
  unit: WeightUnit;
}) {
  const { colors } = useTheme();
  const save = useSaveProfile();
  const today = localDate();
  const imperial = unit === 'LB';
  const toDisplay = (kg: number) => String(Math.round(kgTo(unit, kg) * 10) / 10);

  const initialWeeks = profile ? Math.max(1, Math.ceil(daysBetween(today, profile.goalDate) / 7)) : 12;
  const heightIn = profile ? profile.heightCm / CM_PER_IN : 0;

  const [sex, setSex] = useState<Sex>(profile?.sex ?? 'MALE');
  const [birthYear, setBirthYear] = useState(profile ? String(profile.birthYear) : '');
  const [feet, setFeet] = useState(profile && imperial ? String(Math.floor(heightIn / 12)) : '');
  const [inches, setInches] = useState(profile && imperial ? String(Math.round(heightIn % 12)) : '');
  const [cm, setCm] = useState(profile && !imperial ? String(Math.round(profile.heightCm)) : '');
  const initialCurrent = currentKg ? toDisplay(currentKg) : '';
  const [current, setCurrent] = useState(initialCurrent);
  const [goal, setGoal] = useState(profile ? toDisplay(profile.goalWeightKg) : '');
  const [weeks, setWeeks] = useState(initialWeeks);
  const [activity, setActivity] = useState<ActivityLevel>(profile?.activityLevel ?? 'MODERATE');
  const [adaptive, setAdaptive] = useState(profile?.adaptive ?? true);
  const initialMacros = profile?.customMacros ?? suggestedMacros;
  const [mode, setMode] = useState<'calculated' | 'custom'>(profile?.customMacros ? 'custom' : 'calculated');
  const [protein, setProtein] = useState(initialMacros ? String(initialMacros.proteinG) : '');
  const [carbs, setCarbs] = useState(initialMacros ? String(initialMacros.carbsG) : '');
  const [fat, setFat] = useState(initialMacros ? String(initialMacros.fatG) : '');
  const customKcal = Number(protein) * 4 + Number(carbs) * 4 + Number(fat) * 9;

  const heightCm = imperial ? (Number(feet) * 12 + Number(inches || 0)) * CM_PER_IN : Number(cm);
  const year = Number(birthYear);
  const valid =
    year > 1900 && year <= new Date().getFullYear() - 13 &&
    heightCm >= 100 && heightCm <= 250 &&
    Number(current) > 0 && Number(goal) > 0 &&
    (mode === 'calculated' || (protein !== '' && carbs !== '' && fat !== '' && customKcal >= 800));
  const goalDate = useMemo(() => addDays(today, weeks * 7), [today, weeks]);

  const submit = () =>
    save.mutate(
      {
      sex,
      birthYear: year,
      heightCm: Math.round(heightCm * 10) / 10,
      activityLevel: activity,
      goalWeight: Number(goal),
      weightUnit: unit,
      goalDate,
      adaptive,
      // Only log a weigh-in when it's new information: on edit the field starts at
      // your trend weight, and re-saving that would overwrite today's real reading.
      currentWeight: !profile || current !== initialCurrent ? Number(current) : undefined,
      customMacros: mode === 'custom' ? { proteinG: Number(protein), carbsG: Number(carbs), fatG: Number(fat) } : null,
      },
      { onSuccess: () => router.back() },
    );

  return (
    <View style={{ gap: space.lg }}>
      <Text variant="title2">About you</Text>

      <Field label="Sex (for the energy formula)">
        <SegmentedControl<Sex>
          accessibilityLabel="Sex"
          options={[
            { value: 'MALE', label: 'Male' },
            { value: 'FEMALE', label: 'Female' },
            { value: 'UNSPECIFIED', label: 'Prefer not' },
          ]}
          value={sex}
          onChange={setSex}
        />
      </Field>

      <View style={styles.row}>
        <Field label="Birth year" style={{ flex: 1 }}>
          <NumberInput value={birthYear} onChange={setBirthYear} placeholder="1995" maxLength={4} />
        </Field>
        <Field label="Height" style={{ flex: 1.3 }}>
          {imperial ? (
            <View style={styles.row}>
              <NumberInput value={feet} onChange={setFeet} placeholder="5" suffix="ft" maxLength={1} />
              <NumberInput value={inches} onChange={setInches} placeholder="10" suffix="in" maxLength={2} />
            </View>
          ) : (
            <NumberInput value={cm} onChange={setCm} placeholder="178" suffix="cm" maxLength={3} />
          )}
        </Field>
      </View>

      <View style={styles.row}>
        <Field label="Current weight" style={{ flex: 1 }}>
          <NumberInput value={current} onChange={setCurrent} placeholder={imperial ? '180' : '82'} suffix={unitLabel(unit)} decimal />
        </Field>
        <Field label="Goal weight" style={{ flex: 1 }}>
          <NumberInput value={goal} onChange={setGoal} placeholder={imperial ? '170' : '77'} suffix={unitLabel(unit)} decimal />
        </Field>
      </View>

      <Field label={`Reach it in ${weeks} week${weeks === 1 ? '' : 's'} · by ${shortDate(goalDate)}`}>
        <View style={styles.row}>
          {[-4, -1, 1, 4].map((step) => (
            <Button
              key={step}
              title={step > 0 ? `+${step} wk` : `${step} wk`}
              variant="secondary"
              size="sm"
              fullWidth={false}
              disabled={weeks + step < 1 || weeks + step > 104}
              onPress={() => setWeeks((w) => Math.min(104, Math.max(1, w + step)))}
              style={{ flex: 1 }}
            />
          ))}
        </View>
      </Field>

      <Field label="Activity level">
        <ActivityPicker value={activity} onChange={setActivity} />
      </Field>

      <Text variant="title2" style={{ marginTop: space.md }}>
        Targets
      </Text>
      <SegmentedControl<'calculated' | 'custom'>
        accessibilityLabel="How targets are set"
        options={[
          { value: 'calculated', label: 'Calculate for me' },
          { value: 'custom', label: 'My own macros' },
        ]}
        value={mode}
        onChange={setMode}
      />
      {mode === 'custom' ? (
        <View style={{ gap: space.sm }}>
          <View style={styles.row}>
            <Field label="Protein" style={{ flex: 1 }}>
              <NumberInput value={protein} onChange={setProtein} placeholder="150" suffix="g" maxLength={3} />
            </Field>
            <Field label="Carbs" style={{ flex: 1 }}>
              <NumberInput value={carbs} onChange={setCarbs} placeholder="200" suffix="g" maxLength={4} />
            </Field>
            <Field label="Fat" style={{ flex: 1 }}>
              <NumberInput value={fat} onChange={setFat} placeholder="60" suffix="g" maxLength={3} />
            </Field>
          </View>
          <Text variant="footnote" color="textSecondary">
            = {customKcal.toLocaleString()} kcal a day (4 per gram of protein and carbs, 9 per gram of fat). Your goal
            weight and date are still used to show your expected pace.
          </Text>
        </View>
      ) : (
        <Card style={styles.switchRow}>
          <View style={{ flex: 1 }}>
            <Text variant="headline">Adaptive targets</Text>
            <Text variant="footnote" color="textSecondary">
              After two weeks of logging, compare what you eat with how your weight actually moves, and fine-tune your target.
            </Text>
          </View>
          <Switch value={adaptive} onValueChange={setAdaptive} trackColor={{ true: colors.accent }} accessibilityLabel="Adaptive targets" />
        </Card>
      )}

      {save.error && (
        <Text variant="footnote" color="danger">
          {save.error.message}
        </Text>
      )}
      <Button title={profile ? 'Save changes' : 'Create my plan'} onPress={submit} disabled={!valid} loading={save.isPending} />
    </View>
  );
}

function Field({ label, children, style }: { label: string; children: React.ReactNode; style?: object }) {
  return (
    <View style={[{ gap: space.xs + 2 }, style]}>
      <Text variant="footnote" weight="600" color="textSecondary">
        {label}
      </Text>
      {children}
    </View>
  );
}

function NumberInput({ value, onChange, placeholder, suffix, maxLength = 6, decimal = false }: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  suffix?: string;
  maxLength?: number;
  decimal?: boolean;
}) {
  const { colors } = useTheme();
  return (
    <View style={[styles.input, { backgroundColor: colors.inputBackground, borderColor: colors.border }]}>
      <TextInput
        value={value}
        onChangeText={(t) => onChange(t.replace(decimal ? /[^0-9.,]/g : /\D/g, '').replace(',', '.'))}
        placeholder={placeholder}
        placeholderTextColor={colors.textTertiary}
        keyboardType={decimal ? 'decimal-pad' : 'number-pad'}
        maxLength={maxLength}
        selectionColor={colors.accentText}
        style={[typography.body, styles.inputText, { color: colors.text }]}
        accessibilityLabel={suffix ? `${placeholder ?? ''} ${suffix}` : placeholder}
      />
      {suffix && (
        <Text variant="subhead" color="textTertiary">
          {suffix}
        </Text>
      )}
    </View>
  );
}

function ActivityPicker({ value, onChange }: { value: ActivityLevel; onChange: (v: ActivityLevel) => void }) {
  const { colors } = useTheme();
  return (
    <View style={[styles.panel, { backgroundColor: colors.surface, borderColor: colors.border }]}>
      {ACTIVITY.map((option, i) => {
        const selected = option.value === value;
        return (
          <Pressable
            key={option.value}
            onPress={() => onChange(option.value)}
            accessibilityRole="radio"
            accessibilityState={{ selected }}
            style={[styles.option, i > 0 && { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border }]}>
            <View style={{ flex: 1 }}>
              <Text variant="body" weight={selected ? '600' : '400'}>
                {option.label}
              </Text>
              <Text variant="footnote" color="textSecondary">
                {option.detail}
              </Text>
            </View>
            <Icon name={selected ? 'radio-button-on' : 'radio-button-off'} size={22} color={selected ? 'accentText' : 'textTertiary'} />
          </Pressable>
        );
      })}
    </View>
  );
}

function daysBetween(from: string, to: string): number {
  return Math.round((parseLocalDate(to).getTime() - parseLocalDate(from).getTime()) / 86_400_000);
}

const styles = StyleSheet.create({
  content: { padding: space.lg, gap: space.xl, paddingBottom: space.xxxl },
  row: { flexDirection: 'row', gap: space.sm },
  switchRow: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  input: {
    flex: 1,
    minWidth: 0,
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.xs,
    borderWidth: 1.5,
    borderRadius: radius.md,
    paddingHorizontal: space.md,
    minHeight: hitTarget.large - 4,
  },
  inputText: { flex: 1, minWidth: 0, paddingVertical: space.sm }, // minWidth 0 lets it shrink so the unit suffix stays inside
  panel: { borderRadius: radius.lg, borderWidth: StyleSheet.hairlineWidth, overflow: 'hidden' },
  option: { flexDirection: 'row', alignItems: 'center', gap: space.md, padding: space.md },
});
