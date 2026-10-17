/**
 * One row of the logging table:  SET | PREVIOUS | WEIGHT | REPS | ✓
 *
 * Built for speed between sets:
 * - Empty fields show a greyed-out suggestion (last session's numbers, or the
 *   set above). Tapping ✓ on an empty row logs the suggestion, so repeating
 *   last week is one tap per set.
 * - Tapping PREVIOUS copies those numbers into the fields.
 * - Tapping the set number changes the set type (warm-up/drop/failure) or deletes it.
 */
import * as Haptics from 'expo-haptics';
import { memo } from 'react';
import { Alert, Platform, Pressable, StyleSheet, TextInput, View } from 'react-native';

import { Icon, Text } from '@/components/ui';
import type { SetType } from '@/features/api/types';
import { hitTarget, radius, space, typography } from '@/theme/tokens';
import { useTheme } from '@/theme/useTheme';

import type { DraftSet } from '../activeWorkoutStore';

export const NUMERIC_ACCESSORY_ID = 'workout-numeric-done';

export type Suggestion = { weight: string; reps: string };

type SetRowProps = {
  set: DraftSet;
  label: string;
  /** Last session's set at the same position, e.g. "185 × 8". */
  previous: string | null;
  suggestion: Suggestion | null;
  onChange: (patch: Partial<Pick<DraftSet, 'weight' | 'reps' | 'setType'>>) => void;
  onToggleComplete: () => void;
  onRemove: () => void;
};

const setTypeOptions: { type: SetType; label: string }[] = [
  { type: 'WORKING', label: 'Working set' },
  { type: 'WARMUP', label: 'Warm-up (W)' },
  { type: 'DROP', label: 'Drop set (D)' },
  { type: 'FAILURE', label: 'To failure (F)' },
];

export const SetRow = memo(function SetRow({ set, label, previous, suggestion, onChange, onToggleComplete, onRemove }: SetRowProps) {
  const { colors } = useTheme();
  const done = set.completedAt !== null;

  const openSetMenu = () =>
    Alert.alert(`Set ${label}`, undefined, [
      ...setTypeOptions
        .filter((o) => o.type !== set.setType)
        .map((o) => ({ text: o.label, onPress: () => onChange({ setType: o.type }) })),
      { text: 'Delete set', style: 'destructive' as const, onPress: onRemove },
      { text: 'Cancel', style: 'cancel' as const },
    ]);

  const inputStyle = [
    styles.input,
    typography.number,
    { color: colors.text, backgroundColor: done ? 'transparent' : colors.surfaceRaised },
  ];

  return (
    <View style={[styles.row, done && { backgroundColor: colors.accentMuted }]}>
      <Pressable onPress={openSetMenu} style={styles.setCell} hitSlop={4} accessibilityRole="button" accessibilityLabel={`Set ${label} options`}>
        <Text variant="headline" color={set.setType === 'WORKING' ? 'text' : 'gold'}>
          {label}
        </Text>
      </Pressable>

      <Pressable
        style={styles.previousCell}
        disabled={!previous || done}
        onPress={() => suggestion && onChange({ weight: suggestion.weight, reps: suggestion.reps })}
        accessibilityRole="button"
        accessibilityLabel={previous ? `Previous: ${previous}. Tap to copy.` : 'No previous set'}>
        <Text variant="footnote" color="textTertiary" numberOfLines={1}>
          {previous ?? '—'}
        </Text>
      </Pressable>

      <TextInput
        value={set.weight}
        onChangeText={(text) => onChange({ weight: text.replace(/[^0-9.,]/g, '') })}
        placeholder={suggestion?.weight ?? ''}
        placeholderTextColor={colors.textTertiary}
        keyboardType="decimal-pad"
        selectTextOnFocus
        editable={!done}
        inputAccessoryViewID={Platform.OS === 'ios' ? NUMERIC_ACCESSORY_ID : undefined}
        accessibilityLabel={`Set ${label} weight`}
        style={inputStyle}
      />
      <TextInput
        value={set.reps}
        onChangeText={(text) => onChange({ reps: text.replace(/\D/g, '') })}
        placeholder={suggestion?.reps ?? ''}
        placeholderTextColor={colors.textTertiary}
        keyboardType="number-pad"
        selectTextOnFocus
        editable={!done}
        inputAccessoryViewID={Platform.OS === 'ios' ? NUMERIC_ACCESSORY_ID : undefined}
        accessibilityLabel={`Set ${label} reps`}
        style={inputStyle}
      />

      <Pressable
        onPress={() => {
          Haptics.impactAsync(done ? Haptics.ImpactFeedbackStyle.Light : Haptics.ImpactFeedbackStyle.Medium);
          onToggleComplete();
        }}
        style={[styles.check, { backgroundColor: done ? colors.accent : colors.surfaceRaised }]}
        accessibilityRole="checkbox"
        accessibilityState={{ checked: done }}
        accessibilityLabel={`Set ${label} complete`}>
        <Icon name="checkmark" size={20} color={done ? 'onAccent' : 'textTertiary'} />
      </Pressable>
    </View>
  );
});

/** Column headers, kept in this file so widths always match the row. */
export function SetTableHeader({ unitLabel }: { unitLabel: string }) {
  return (
    <View style={[styles.row, styles.header]}>
      <Text variant="caption" color="textTertiary" style={styles.setCell} align="center">SET</Text>
      <Text variant="caption" color="textTertiary" style={styles.previousCell}>PREVIOUS</Text>
      <Text variant="caption" color="textTertiary" style={styles.headerInput} align="center">{unitLabel.toUpperCase()}</Text>
      <Text variant="caption" color="textTertiary" style={styles.headerInput} align="center">REPS</Text>
      <View style={styles.headerCheck}>
        <Icon name="checkmark" size={14} color="textTertiary" />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    paddingVertical: space.xs,
    paddingHorizontal: space.xs,
    borderRadius: radius.sm,
  },
  header: { paddingVertical: 0 },
  setCell: { width: 32, alignItems: 'center' },
  previousCell: { flex: 1, minWidth: 64 },
  input: {
    width: 68,
    height: hitTarget.min - 4,
    borderRadius: radius.sm,
    textAlign: 'center',
    paddingHorizontal: space.xs,
  },
  headerInput: { width: 68 },
  check: { width: hitTarget.min - 4, height: hitTarget.min - 4, borderRadius: radius.sm, alignItems: 'center', justifyContent: 'center' },
  headerCheck: { width: hitTarget.min - 4, alignItems: 'center' },
});
