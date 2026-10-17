/**
 * Goal setup and target breakdown. A short form (sex, birth year, height,
 * current and goal weight, timeline, activity) drives calorie and macro
 * targets; below it, the targets are explained in plain language, including
 * when the safety limits changed the plan.
 */
import { Stack } from 'expo-router';
import { useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Switch, TextInput, View } from 'react-native';

import { Button, Card, Icon, SegmentedControl, Text } from '@/components/ui';
import { useWeightUnit } from '@/features/api/queries';
import type { ActivityLevel, NutritionProfile, Sex, TargetsResponse, WeightUnit } from '@/features/api/types';
import { useBodyWeights } from '@/features/body/queries';
import { useNutritionProfile, useSaveProfile, useTargets } from '@/features/nutrition/queries';
import { parseLocalDate, shortDate } from '@/features/progress/dates';
import { formatWeight, kgTo, unitLabel } from '@/features/workout/format';
import { addDays, localDate } from '@/lib/dates';
import { hitTarget, radius, space, typography } from '@/theme/tokens';
import { useTheme } from '@/theme/useTheme';

const ACTIVITY: { value: ActivityLevel; label: string; detail: string }[] = [
  { value: 'SEDENTARY', label: 'Mostly sitting', detail: 'Desk job, little exercise' },
  { value: 'LIGHT', label: 'Lightly active', detail: 'Exercise 1–3 days a week' },
  { value: 'MODERATE', label: 'Moderately active', detail: 'Exercise 3–5 days a week' },
  { value: 'ACTIVE', label: 'Very active', detail: 'Hard exercise 6–7 days a week' },
  { value: 'VERY_ACTIVE', label: 'Extremely active', detail: 'Physical job plus training' },
];

const CM_PER_IN = 2.54;

export default function GoalsScreen() {
  const profile = useNutritionProfile();
  const targets = useTargets();
  const weights = useBodyWeights(null);
  const unit = useWeightUnit();

  if (profile.isPending || weights.isPending) return <ActivityIndicator style={{ flex: 1 }} />;

  return (
    <ScrollView contentInsetAdjustmentBehavior="automatic" contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
      <Stack.Screen options={{ title: 'Goal' }} />
      {targets.data && <TargetsCard data={targets.data} unit={unit} />}
      <GoalForm
        // Re-mount with fresh defaults once data arrives.
        key={profile.data ? 'edit' : 'new'}
        profile={profile.data ?? null}
        currentKg={weights.data?.currentTrendKg ?? null}
        unit={unit}
      />
      <Text variant="caption" color="textTertiary" align="center">
        Targets are estimates based on standard formulas, not medical advice. If you have a health condition, are
        pregnant, or have a history of disordered eating, check with a professional first.
      </Text>
    </ScrollView>
  );
}

function GoalForm({ profile, currentKg, unit }: { profile: NutritionProfile | null; currentKg: number | null; unit: WeightUnit }) {
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
  const [current, setCurrent] = useState(currentKg ? toDisplay(currentKg) : '');
  const [goal, setGoal] = useState(profile ? toDisplay(profile.goalWeightKg) : '');
  const [weeks, setWeeks] = useState(initialWeeks);
  const [activity, setActivity] = useState<ActivityLevel>(profile?.activityLevel ?? 'MODERATE');
  const [adaptive, setAdaptive] = useState(profile?.adaptive ?? true);

  const heightCm = imperial ? (Number(feet) * 12 + Number(inches || 0)) * CM_PER_IN : Number(cm);
  const year = Number(birthYear);
  const valid =
    year > 1900 && year <= new Date().getFullYear() - 13 &&
    heightCm >= 100 && heightCm <= 250 &&
    Number(current) > 0 && Number(goal) > 0;
  const goalDate = useMemo(() => addDays(today, weeks * 7), [today, weeks]);

  const submit = () =>
    save.mutate({
      sex,
      birthYear: year,
      heightCm: Math.round(heightCm * 10) / 10,
      activityLevel: activity,
      goalWeight: Number(goal),
      weightUnit: unit,
      goalDate,
      adaptive,
      currentWeight: Number(current),
    });

  return (
    <View style={{ gap: space.lg }}>
      <Text variant="title2">{profile ? 'Your details' : 'Set your goal'}</Text>

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

      <Card style={styles.switchRow}>
        <View style={{ flex: 1 }}>
          <Text variant="headline">Adaptive targets</Text>
          <Text variant="footnote" color="textSecondary">
            After two weeks of logging, compare what you eat with how your weight actually moves, and fine-tune your target.
          </Text>
        </View>
        <Switch value={adaptive} onValueChange={setAdaptive} accessibilityLabel="Adaptive targets" />
      </Card>

      {save.error && (
        <Text variant="footnote" color="danger">
          {save.error.message}
        </Text>
      )}
      <Button title={profile ? 'Update goal' : 'Calculate my targets'} onPress={submit} disabled={!valid} loading={save.isPending} />
    </View>
  );
}

/** What the targets are and why, in plain language. */
function TargetsCard({ data, unit }: { data: TargetsResponse; unit: WeightUnit }) {
  const { colors } = useTheme();
  const t = data.targets;
  const fmt = (kg: number) => `${formatWeight(Math.round(kgTo(unit, kg) * 10) / 10)} ${unitLabel(unit)}`;
  const rate = `${formatWeight(Math.round(Math.abs(kgTo(unit, t.weeklyRateKg)) * 10) / 10)} ${unitLabel(unit)}/week`;
  const plan =
    t.goal === 'MAINTAIN'
      ? 'You’re at your goal, so this keeps your weight steady.'
      : `${t.goal === 'LOSE' ? 'Losing' : 'Gaining'} about ${rate}${t.projectedGoalDate ? `, reaching ${fmt(data.goalWeightKg)} around ${shortDate(t.projectedGoalDate)}` : ''}.`;

  return (
    <Card style={{ gap: space.md, borderColor: colors.accent, borderWidth: 1.5 }}>
      <Text variant="caption" color="textSecondary">
        DAILY TARGET
      </Text>
      <Text style={styles.kcal}>{t.calories.toLocaleString()} kcal</Text>
      <View style={styles.row}>
        <Stat label="Protein" value={`${t.proteinG} g`} />
        <Stat label="Carbs" value={`${t.carbsG} g`} />
        <Stat label="Fat" value={`${t.fatG} g`} />
      </View>
      <Text variant="subhead">{plan}</Text>
      <Text variant="footnote" color="textSecondary">
        Maintenance ≈ {t.tdee.toLocaleString()} kcal/day
        {t.tdeeSource === 'ADAPTIVE'
          ? `, adjusted from your last ${data.adaptiveLoggedDays} logged days and weight trend (formula estimate: ${t.formulaTdee.toLocaleString()}).`
          : ` (estimated from your body and activity${data.adaptiveLoggedDays > 0 ? `; adaptive kicks in after 14 logged days, you have ${data.adaptiveLoggedDays}` : ''}).`}{' '}
        {t.dailyDeltaKcal !== 0 && `Target is ${Math.abs(t.dailyDeltaKcal)} kcal ${t.dailyDeltaKcal < 0 ? 'below' : 'above'} that.`}
      </Text>
      {t.rateCapped && t.goal !== 'MAINTAIN' && (
        <View style={[styles.notice, { backgroundColor: colors.surfaceRaised }]}>
          <Icon name="shield-checkmark-outline" size={18} color="accentText" />
          <Text variant="footnote" color="textSecondary" style={{ flex: 1 }}>
            {t.atCalorieFloor
              ? `Your timeline would need fewer calories than is safe without supervision, so the target stays at ${t.calories.toLocaleString()} kcal.`
              : `Your timeline is faster than a safe pace, so the plan uses ${rate} instead${t.projectedGoalDate ? ` (about ${shortDate(t.projectedGoalDate)})` : ''}.`}
          </Text>
        </View>
      )}
      <Text variant="caption" color="textTertiary">
        Fiber {t.fiberG} g · Water {(t.waterMl / 1000).toFixed(1)} L
      </Text>
    </Card>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <View style={{ flex: 1 }}>
      <Text variant="caption" color="textSecondary">
        {label}
      </Text>
      <Text variant="headline">{value}</Text>
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
  kcal: { fontSize: 40, lineHeight: 46, fontWeight: '800' },
  notice: { flexDirection: 'row', gap: space.sm, padding: space.md, borderRadius: radius.md },
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
