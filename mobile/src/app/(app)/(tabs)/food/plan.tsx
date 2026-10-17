/**
 * My Plan: daily targets and the details they come from, in one place.
 * Read-only here (like a settings summary); "Edit plan" opens the form.
 */
import { router, Stack } from 'expo-router';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { Button, Card, Icon, Text } from '@/components/ui';
import { useWeightUnit } from '@/features/api/queries';
import { useBodyWeights } from '@/features/body/queries';
import { activityLabel, heightLabel, sexLabel } from '@/features/nutrition/activity';
import { useNutritionProfile, useTargets } from '@/features/nutrition/queries';
import { TargetsCard } from '@/features/nutrition/TargetsCard';
import { parseLocalDate, shortDate } from '@/features/progress/dates';
import { formatWeight, kgTo, unitLabel } from '@/features/workout/format';
import { localDate } from '@/lib/dates';
import { space } from '@/theme/tokens';
import { useTheme } from '@/theme/useTheme';

export default function PlanScreen() {
  const profile = useNutritionProfile();
  const targets = useTargets();
  const weights = useBodyWeights(null);
  const unit = useWeightUnit();

  if (profile.isPending) return <ActivityIndicator style={{ flex: 1 }} />;
  const p = profile.data;
  const fmt = (kg: number) => `${formatWeight(Math.round(kgTo(unit, kg) * 10) / 10)} ${unitLabel(unit)}`;

  if (!p) {
    return (
      <ScrollView contentInsetAdjustmentBehavior="automatic" contentContainerStyle={styles.content}>
        <Stack.Screen options={{ title: 'My Plan' }} />
        <Card style={{ gap: space.md, alignItems: 'flex-start' }}>
          <Icon name="flag-outline" size={28} color="accentText" />
          <Text variant="title2">Set up your plan</Text>
          <Text variant="callout" color="textSecondary">
            Answer a few questions about your body, goal weight and timeline, and get daily calorie, protein, carb and fat
            targets. They adapt as you log, and you can set your own macros instead.
          </Text>
          <Button title="Set up my plan" onPress={() => router.push('/food/goals')} />
        </Card>
      </ScrollView>
    );
  }

  const weeksLeft = Math.max(0, Math.round((parseLocalDate(p.goalDate).getTime() - parseLocalDate(localDate()).getTime()) / (7 * 86_400_000)));
  const current = weights.data?.currentTrendKg;

  return (
    <ScrollView contentInsetAdjustmentBehavior="automatic" contentContainerStyle={styles.content}>
      <Stack.Screen options={{ title: 'My Plan' }} />
      {targets.data && <TargetsCard data={targets.data} unit={unit} />}

      <View style={{ gap: space.sm }}>
        <Text variant="footnote" weight="600" color="textSecondary">
          YOUR DETAILS
        </Text>
        <Card style={{ padding: 0, gap: 0 }}>
          <Row label="Sex" value={sexLabel[p.sex]} first />
          <Row label="Age" value={`${new Date().getFullYear() - p.birthYear}`} />
          <Row label="Height" value={heightLabel(p.heightCm, unit === 'LB')} />
          <Row
            label="Current weight"
            value={current ? `${fmt(current)} trend` : 'Not logged'}
            onPress={() => router.push('/weigh-in')}
          />
          <Row label="Goal weight" value={fmt(p.goalWeightKg)} />
          <Row label="Goal date" value={`${shortDate(p.goalDate)} · ${weeksLeft} wk`} />
          <Row label="Activity" value={activityLabel(p.activityLevel)} />
          <Row
            label="Targets"
            value={p.customMacros ? 'Your own macros' : p.adaptive ? 'Calculated · adaptive' : 'Calculated'}
          />
        </Card>
      </View>

      <Button title="Edit plan" icon="create-outline" onPress={() => router.push('/food/goals')} />
      <Text variant="caption" color="textTertiary" align="center">
        Targets are estimates based on standard formulas, not medical advice. If you have a health condition, are
        pregnant, or have a history of disordered eating, check with a professional first.
      </Text>
    </ScrollView>
  );
}

function Row({ label, value, first, onPress }: { label: string; value: string; first?: boolean; onPress?: () => void }) {
  const { colors } = useTheme();
  const content = (
    <>
      <Text variant="body" style={{ flex: 1 }}>
        {label}
      </Text>
      <Text variant="body" color="textSecondary" numberOfLines={1} style={{ flexShrink: 1 }}>
        {value}
      </Text>
      {onPress && <Icon name="chevron-forward" size={16} color="textTertiary" />}
    </>
  );
  const style = [styles.row, !first && { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border }];
  return onPress ? (
    <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel={`${label}: ${value}`} style={style}>
      {content}
    </Pressable>
  ) : (
    <View style={style} accessible accessibilityLabel={`${label}: ${value}`}>
      {content}
    </View>
  );
}

const styles = StyleSheet.create({
  content: { padding: space.lg, gap: space.xl, paddingBottom: space.xxxl },
  row: { flexDirection: 'row', alignItems: 'center', gap: space.sm, paddingHorizontal: space.lg, paddingVertical: space.md, minHeight: 48 },
});
