/**
 * Food diary for one day: calories and macros vs. targets, water, the four
 * meals, and a nudge to weigh in. Swipe days with the arrows in the header.
 */
import { router, Stack } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, Alert, Pressable, RefreshControl, ScrollView, StyleSheet, View } from 'react-native';

import { Button, Card, Icon, Text } from '@/components/ui';
import type { DiaryEntry, Meal } from '@/features/api/types';
import { useBodyWeights } from '@/features/body/queries';
import { DaySummary } from '@/features/food/DaySummary';
import { amountLabel, MEALS, mealLabel } from '@/features/food/meals';
import { useCopyMeal, useDeleteEntry, useDiaryDay, useSetWater } from '@/features/food/queries';
import { useNutritionProfile, useTargets } from '@/features/nutrition/queries';
import { addDays, dayLabel, localDate } from '@/lib/dates';
import { radius, space } from '@/theme/tokens';
import { useTheme } from '@/theme/useTheme';

const GLASS_ML = 250;

export default function FoodDiaryScreen() {
  const today = localDate();
  const [date, setDate] = useState(today);
  const day = useDiaryDay(date);
  const yesterday = useDiaryDay(addDays(date, -1));
  const profile = useNutritionProfile();
  const targets = useTargets();
  const weights = useBodyWeights(addDays(today, -1));

  const weighedToday = weights.data?.entries.some((e) => e.date === today) ?? true;

  return (
    <ScrollView
      contentInsetAdjustmentBehavior="automatic"
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={day.isRefetching && !day.isPlaceholderData} onRefresh={() => void day.refetch()} />}>
      <Stack.Screen
        options={{
          headerRight: () => (
            <Pressable onPress={() => router.push('/food/recipes')} hitSlop={10} accessibilityRole="button" accessibilityLabel="Recipes">
              <Icon name="book-outline" size={22} color="accentText" />
            </Pressable>
          ),
        }}
      />
      <DaySwitcher date={date} today={today} onChange={setDate} />

      {profile.data === null && (
        <Card onPress={() => router.push('/food/goals')} style={styles.setup} accessibilityLabel="Set your goal">
          <Icon name="flag-outline" size={22} color="accentText" />
          <View style={{ flex: 1 }}>
            <Text variant="headline">Set your goal</Text>
            <Text variant="footnote" color="textSecondary">
              Get daily calorie and macro targets based on your body and timeline.
            </Text>
          </View>
          <Icon name="chevron-forward" size={16} color="textTertiary" />
        </Card>
      )}

      {day.isPending ? (
        <ActivityIndicator style={{ marginTop: space.xl }} />
      ) : day.data ? (
        <View style={[styles.sections, day.isPlaceholderData && { opacity: 0.5 }]}>
          <DaySummary totals={day.data.totals} targets={targets.data ?? null} />
          <Water date={date} ml={day.data.waterMl} goalMl={targets.data?.targets.waterMl ?? 2500} />
          {MEALS.map((meal) => (
            <MealSection
              key={meal}
              meal={meal}
              date={date}
              entries={day.data!.entries.filter((e) => e.meal === meal)}
              yesterdayCount={yesterday.data?.entries.filter((e) => e.meal === meal).length ?? 0}
            />
          ))}
        </View>
      ) : null}

      {date === today && !weighedToday && (
        <Button title="Log today's weight" icon="scale-outline" variant="secondary" onPress={() => router.push('/weigh-in')} />
      )}
    </ScrollView>
  );
}

function DaySwitcher({ date, today, onChange }: { date: string; today: string; onChange: (d: string) => void }) {
  return (
    <View style={styles.switcher}>
      <Pressable onPress={() => onChange(addDays(date, -1))} hitSlop={12} accessibilityRole="button" accessibilityLabel="Previous day">
        <Icon name="chevron-back" size={24} color="accentText" />
      </Pressable>
      <Pressable onPress={() => onChange(today)} accessibilityRole="button" accessibilityLabel="Go to today">
        <Text variant="headline">{dayLabel(date, today)}</Text>
      </Pressable>
      <Pressable
        onPress={() => onChange(addDays(date, 1))}
        disabled={date >= today}
        hitSlop={12}
        accessibilityRole="button"
        accessibilityLabel="Next day"
        style={{ opacity: date >= today ? 0.3 : 1 }}>
        <Icon name="chevron-forward" size={24} color="accentText" />
      </Pressable>
    </View>
  );
}

function Water({ date, ml, goalMl }: { date: string; ml: number; goalMl: number }) {
  const { colors } = useTheme();
  const setWater = useSetWater();
  const glasses = Math.round(ml / GLASS_ML);
  const goalGlasses = Math.max(1, Math.round(goalMl / GLASS_ML));
  return (
    <Card style={styles.water}>
      <Icon name="water-outline" size={22} color="accentText" />
      <View style={{ flex: 1 }}>
        <Text variant="headline">Water</Text>
        <Text variant="footnote" color="textSecondary">
          {glasses} of {goalGlasses} glasses · {(ml / 1000).toFixed(2).replace(/\.?0+$/, '')} L
        </Text>
      </View>
      <Pressable
        onPress={() => setWater.mutate({ date, ml: Math.max(0, ml - GLASS_ML) })}
        disabled={ml === 0}
        accessibilityRole="button"
        accessibilityLabel="Remove a glass"
        style={[styles.waterButton, { backgroundColor: colors.surfaceRaised, opacity: ml === 0 ? 0.4 : 1 }]}>
        <Icon name="remove" size={20} />
      </Pressable>
      <Pressable
        onPress={() => setWater.mutate({ date, ml: ml + GLASS_ML })}
        accessibilityRole="button"
        accessibilityLabel="Add a glass of water"
        style={[styles.waterButton, { backgroundColor: colors.accent }]}>
        <Icon name="add" size={20} color="onAccent" />
      </Pressable>
    </Card>
  );
}

function MealSection({ meal, date, entries, yesterdayCount }: { meal: Meal; date: string; entries: DiaryEntry[]; yesterdayCount: number }) {
  const { colors } = useTheme();
  const remove = useDeleteEntry();
  const copy = useCopyMeal();
  const kcal = Math.round(entries.reduce((sum, e) => sum + e.nutrients.kcal, 0));
  const add = () => router.push({ pathname: '/food/add', params: { meal, date } });

  const openEntry = (entry: DiaryEntry) => {
    if (entry.kind === 'QUICK') {
      Alert.alert(entry.name, `${Math.round(entry.nutrients.kcal)} kcal`, [
        { text: 'Delete', style: 'destructive', onPress: () => remove.mutate({ id: entry.id, date }) },
        { text: 'Cancel', style: 'cancel' },
      ]);
      return;
    }
    router.push({
      pathname: '/food/item',
      params: {
        entryId: entry.id,
        date,
        meal,
        amount: String(entry.amount),
        unit: entry.amountUnit,
        ...(entry.foodId ? { foodId: entry.foodId } : {}),
        ...(entry.recipeId ? { recipeId: entry.recipeId } : {}),
      },
    });
  };

  return (
    <View style={{ gap: space.sm }}>
      <View style={styles.mealHeader}>
        <Text variant="title2" style={{ flex: 1 }}>
          {mealLabel[meal]}
        </Text>
        {kcal > 0 && (
          <Text variant="subhead" color="textSecondary">
            {kcal.toLocaleString()} kcal
          </Text>
        )}
        <Pressable onPress={add} hitSlop={10} accessibilityRole="button" accessibilityLabel={`Add food to ${mealLabel[meal]}`}>
          <Icon name="add-circle" size={26} color="accentText" />
        </Pressable>
      </View>
      {entries.length > 0 ? (
        <View style={[styles.panel, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          {entries.map((entry, i) => (
            <Pressable
              key={entry.id}
              onPress={() => openEntry(entry)}
              onLongPress={() =>
                Alert.alert(entry.name, undefined, [
                  { text: 'Delete', style: 'destructive', onPress: () => remove.mutate({ id: entry.id, date }) },
                  { text: 'Cancel', style: 'cancel' },
                ])
              }
              accessibilityRole="button"
              accessibilityHint="Tap to edit, long-press to delete"
              style={({ pressed }) => [
                styles.row,
                i > 0 && { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border },
                pressed && { backgroundColor: colors.surfaceRaised },
              ]}>
              <View style={{ flex: 1, gap: 2 }}>
                <Text variant="body" numberOfLines={1}>
                  {entry.name}
                </Text>
                <Text variant="footnote" color="textSecondary">
                  {entry.kind === 'QUICK' ? 'Quick add' : amountLabel(entry.amount, entry.amountUnit)}
                  {` · P ${Math.round(entry.nutrients.proteinG)} · C ${Math.round(entry.nutrients.carbsG)} · F ${Math.round(entry.nutrients.fatG)}`}
                </Text>
              </View>
              <Text variant="number">{Math.round(entry.nutrients.kcal)}</Text>
            </Pressable>
          ))}
        </View>
      ) : (
        <View style={[styles.empty, { borderColor: colors.border }]}>
          <Pressable onPress={add} style={styles.emptyAction} accessibilityRole="button">
            <Text variant="subhead" color="accentText" weight="600">
              Add food
            </Text>
          </Pressable>
          {yesterdayCount > 0 && (
            <Pressable
              onPress={() => copy.mutate({ date, fromDate: addDays(date, -1), meal })}
              style={styles.emptyAction}
              accessibilityRole="button"
              accessibilityLabel={`Copy ${mealLabel[meal].toLowerCase()} from the day before`}>
              <Icon name="copy-outline" size={16} color="accentText" />
              <Text variant="subhead" color="accentText" weight="600">
                Copy previous day ({yesterdayCount})
              </Text>
            </Pressable>
          )}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  content: { padding: space.lg, gap: space.lg, paddingBottom: space.xxxl },
  sections: { gap: space.xl },
  switcher: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  setup: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  water: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  waterButton: { width: 40, height: 40, borderRadius: radius.pill, alignItems: 'center', justifyContent: 'center' },
  mealHeader: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  panel: { borderRadius: radius.lg, borderWidth: StyleSheet.hairlineWidth, overflow: 'hidden' },
  row: { flexDirection: 'row', alignItems: 'center', gap: space.md, paddingHorizontal: space.lg, paddingVertical: space.md },
  empty: { flexDirection: 'row', flexWrap: 'wrap', gap: space.lg, padding: space.md, borderRadius: radius.lg, borderWidth: 1, borderStyle: 'dashed' },
  emptyAction: { flexDirection: 'row', alignItems: 'center', gap: space.xs, paddingVertical: space.xs },
});
