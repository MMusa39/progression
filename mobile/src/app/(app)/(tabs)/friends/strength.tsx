/**
 * Strength board: best estimated one-rep max per person on a chosen lift.
 * It's a ranking to browse, deliberately with no winner or crown, because
 * absolute strength mostly reflects body size and years of training.
 */
import { Stack, router } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { EmptyState, Text } from '@/components/ui';
import { useStrengthBoard, useStrengthExercises, useWeightUnit } from '@/features/api/queries';
import { Avatar } from '@/features/friends/Avatar';
import { personName } from '@/features/friends/names';
import { shortDate } from '@/features/progress/dates';
import { formatWeight, kgTo, unitLabel } from '@/features/workout/format';
import { radius, space } from '@/theme/tokens';
import { useTheme } from '@/theme/useTheme';

export default function StrengthBoardScreen() {
  const { colors } = useTheme();
  const unit = useWeightUnit();
  const exercises = useStrengthExercises();
  const [selected, setSelected] = useState<string | null>(null);
  const board = useStrengthBoard(selected);
  const activeId = board.data?.exercise?.id ?? selected;

  if (exercises.isPending || board.isPending) return <ActivityIndicator style={{ flex: 1 }} />;
  if ((exercises.data ?? []).length === 0) {
    return <EmptyState icon="barbell-outline" title="No lifts to compare yet" message="Once you or your friends log weighted lifts, you can compare them here." />;
  }

  return (
    <ScrollView contentInsetAdjustmentBehavior="automatic" contentContainerStyle={styles.content}>
      <Stack.Screen options={{ title: 'Strength' }} />
      <Text variant="subhead" color="textSecondary">
        Best estimated 1-rep max on each lift, all time. Everyone&apos;s starting point is different, so this is for comparing, not winning.
      </Text>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
        {exercises.data!.map((exercise) => {
          const active = exercise.id === activeId;
          return (
            <Pressable
              key={exercise.id}
              onPress={() => setSelected(exercise.id)}
              accessibilityRole="button"
              accessibilityState={{ selected: active }}
              style={[styles.chip, { backgroundColor: active ? colors.accent : colors.surfaceRaised }]}>
              <Text variant="subhead" weight="600" color={active ? 'onAccent' : 'textSecondary'}>
                {exercise.name}
              </Text>
            </Pressable>
          );
        })}
      </ScrollView>

      <View style={[styles.panel, { backgroundColor: colors.surface, borderColor: colors.border }, board.isPlaceholderData && { opacity: 0.5 }]}>
        {(board.data?.entries ?? []).map((entry, i) => {
          const e1rm = `${Math.round(kgTo(unit, entry.bestE1rmKg))} ${unitLabel(unit)}`;
          return (
            <Pressable
              key={entry.user.id}
              disabled={entry.you}
              onPress={() => router.push(`/friends/${entry.user.id}`)}
              accessibilityLabel={`${entry.you ? 'You' : personName(entry.user)}: estimated one rep max ${e1rm}, from ${formatWeight(entry.weight)} ${unitLabel(entry.weightUnit)} for ${entry.reps}`}
              style={[
                styles.row,
                i > 0 && { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border },
                entry.you && { backgroundColor: colors.accentMuted },
              ]}>
              <Text variant="headline" color="textSecondary" style={styles.rank}>
                {entry.rank}
              </Text>
              <Avatar user={entry.user} size={36} you={entry.you} />
              <View style={{ flex: 1 }}>
                <Text variant="body" weight="600" numberOfLines={1}>
                  {entry.you ? 'You' : personName(entry.user)}
                </Text>
                <Text variant="footnote" color="textSecondary">
                  {formatWeight(entry.weight)} {unitLabel(entry.weightUnit)} × {entry.reps} · {shortDate(entry.achievedAt)}
                </Text>
              </View>
              <View style={styles.value}>
                <Text variant="headline">{e1rm}</Text>
                <Text variant="caption" color="textTertiary">
                  est. 1RM
                </Text>
              </View>
            </Pressable>
          );
        })}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { padding: space.lg, gap: space.lg, paddingBottom: space.xxxl },
  chips: { gap: space.sm },
  chip: { paddingHorizontal: space.md, paddingVertical: space.sm - 2, borderRadius: radius.pill },
  panel: { borderRadius: radius.lg, borderWidth: StyleSheet.hairlineWidth, overflow: 'hidden' },
  row: { flexDirection: 'row', alignItems: 'center', gap: space.md, paddingHorizontal: space.lg, paddingVertical: space.md },
  rank: { width: 22, textAlign: 'center' },
  value: { alignItems: 'flex-end' },
});
