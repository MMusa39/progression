import { StyleSheet, View } from 'react-native';

import { Card, Icon, Text } from '@/components/ui';
import type { TargetsResponse, WeightUnit } from '@/features/api/types';
import { shortDate } from '@/features/progress/dates';
import { formatWeight, kgTo, unitLabel } from '@/features/workout/format';
import { radius, space } from '@/theme/tokens';
import { useTheme } from '@/theme/useTheme';

/** Daily targets and why, in plain language, including when the safety limits changed the plan. */
export function TargetsCard({ data, unit }: { data: TargetsResponse; unit: WeightUnit }) {
  const { colors } = useTheme();
  const t = data.targets;
  const custom = t.mode === 'CUSTOM';
  const fmt = (kg: number) => `${formatWeight(Math.round(kgTo(unit, kg) * 10) / 10)} ${unitLabel(unit)}`;
  const rate = `${formatWeight(Math.round(Math.abs(kgTo(unit, t.weeklyRateKg)) * 10) / 10)} ${unitLabel(unit)}/week`;
  const direction = t.weeklyRateKg < 0 ? 'Losing' : 'Gaining';
  const plan =
    t.goal === 'MAINTAIN' && !custom
      ? 'You’re at your goal, so this keeps your weight steady.'
      : Math.abs(t.weeklyRateKg) < 0.05
        ? 'At this intake your weight should hold steady.'
        : `${direction} about ${rate}${t.projectedGoalDate ? `, reaching ${fmt(data.goalWeightKg)} around ${shortDate(t.projectedGoalDate)}` : ''}.`;
  const kcalPct = (grams: number, perGram: number) => (t.calories > 0 ? Math.round(((grams * perGram) / t.calories) * 100) : 0);

  return (
    <Card style={{ gap: space.md, borderColor: colors.accent, borderWidth: 1.5 }}>
      <Text variant="caption" color="textSecondary">
        {custom ? 'DAILY TARGET · YOUR MACROS' : 'DAILY TARGET'}
      </Text>
      <Text style={styles.kcal}>{t.calories.toLocaleString()} kcal</Text>
      <View style={styles.row}>
        <Stat label="Protein" value={`${t.proteinG} g`} detail={`${kcalPct(t.proteinG, 4)}%`} />
        <Stat label="Carbs" value={`${t.carbsG} g`} detail={`${kcalPct(t.carbsG, 4)}%`} />
        <Stat label="Fat" value={`${t.fatG} g`} detail={`${kcalPct(t.fatG, 9)}%`} />
      </View>
      <Text variant="subhead">{plan}</Text>
      <Text variant="footnote" color="textSecondary">
        Maintenance ≈ {t.tdee.toLocaleString()} kcal/day
        {t.tdeeSource === 'ADAPTIVE'
          ? `, adjusted from your last ${data.adaptiveLoggedDays} logged days and weight trend (formula estimate: ${t.formulaTdee.toLocaleString()}).`
          : ` (estimated from your body and activity${data.adaptiveLoggedDays > 0 ? `; adaptive kicks in after 14 logged days, you have ${data.adaptiveLoggedDays}` : ''}).`}{' '}
        {t.dailyDeltaKcal !== 0 && `Target is ${Math.abs(t.dailyDeltaKcal).toLocaleString()} kcal ${t.dailyDeltaKcal < 0 ? 'below' : 'above'} that.`}
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

function Stat({ label, value, detail }: { label: string; value: string; detail: string }) {
  return (
    <View style={{ flex: 1 }}>
      <Text variant="caption" color="textSecondary">
        {label}
      </Text>
      <Text variant="headline">
        {value}{' '}
        <Text variant="caption" color="textTertiary">
          {detail}
        </Text>
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: space.sm },
  kcal: { fontSize: 40, lineHeight: 46, fontWeight: '800' },
  notice: { flexDirection: 'row', gap: space.sm, padding: space.md, borderRadius: radius.md },
});
