/**
 * The active workout logger, presented as a sheet over the tabs. Swiping it
 * down keeps the workout running (resume from the Workout tab), and Finish
 * saves it.
 *
 * All edits go to the on-device store (activeWorkoutStore) and are persisted
 * immediately; the server is only involved when the workout is finished.
 */
import { useQueryClient } from '@tanstack/react-query';
import * as Haptics from 'expo-haptics';
import { router } from 'expo-router';
import {
  Alert,
  InputAccessoryView,
  Keyboard,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Button, Icon, Text } from '@/components/ui';
import { useWeightUnit } from '@/features/api/queries';
import { useActiveWorkout, workoutProgress } from '@/features/workout/activeWorkoutStore';
import { ElapsedTimer } from '@/features/workout/components/ElapsedTimer';
import { ExerciseCard } from '@/features/workout/components/ExerciseCard';
import { NUMERIC_ACCESSORY_ID } from '@/features/workout/components/SetRow';
import { useWorkoutSync } from '@/features/workout/workoutSync';
import { space, typography } from '@/theme/tokens';
import { useTheme } from '@/theme/useTheme';

export default function ActiveWorkoutScreen() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const queryClient = useQueryClient();
  const unit = useWeightUnit();
  const active = useActiveWorkout((s) => s.active);

  // Briefly null while the sheet animates away after Finish/Discard.
  if (!active) return <View style={[styles.root, { backgroundColor: colors.background }]} />;

  const finish = () => {
    const { completed, total } = workoutProgress(active);
    if (completed === 0) {
      Alert.alert('No sets completed', 'Tick off at least one set to save this workout, or discard it.', [
        { text: 'Keep going', style: 'cancel' },
        { text: 'Discard workout', style: 'destructive', onPress: discard },
      ]);
      return;
    }
    const unfinished = total - completed;
    Alert.alert(
      'Finish workout?',
      unfinished > 0
        ? `${unfinished} unfinished set${unfinished > 1 ? 's' : ''} will be discarded.`
        : `${completed} sets logged. Nice work!`,
      [
        { text: 'Keep going', style: 'cancel' },
        {
          text: 'Finish',
          onPress: () => {
            const result = useActiveWorkout.getState().finish();
            if (!result) return;
            const sync = useWorkoutSync.getState();
            sync.enqueue(result);
            sync.flush(queryClient);
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            router.back();
          },
        },
      ],
    );
  };

  function discard() {
    useActiveWorkout.getState().discard();
    router.back();
  }

  const confirmDiscard = () =>
    Alert.alert('Discard workout?', "Everything you've logged in this workout will be deleted.", [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Discard', style: 'destructive', onPress: discard },
    ]);

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      {/* Top bar: minimize · live timer · finish */}
      <View style={[styles.topBar, { borderBottomColor: colors.border }]}>
        <Pressable onPress={() => router.back()} hitSlop={12} accessibilityRole="button" accessibilityLabel="Minimize workout">
          <Icon name="chevron-down" size={26} color="textSecondary" />
        </Pressable>
        <ElapsedTimer since={active.startedAt} variant="number" style={styles.timer} />
        <Button title="Finish" size="sm" fullWidth={false} onPress={finish} />
      </View>

      <ScrollView
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + space.xxxl }]}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="interactive"
        automaticallyAdjustKeyboardInsets>
        <TextInput
          value={active.name}
          onChangeText={useActiveWorkout.getState().rename}
          style={[typography.title, { color: colors.text }]}
          selectionColor={colors.accentText}
          accessibilityLabel="Workout name"
          returnKeyType="done"
        />

        {active.exercises.length === 0 && (
          <View style={[styles.emptyHint, { borderColor: colors.border }]}>
            <Icon name="barbell-outline" size={28} color="textTertiary" />
            <Text variant="subhead" color="textSecondary" align="center">
              Add your first exercise to start logging sets.
            </Text>
          </View>
        )}

        {active.exercises.map((item, index) => (
          <ExerciseCard
            key={item.id}
            workoutId={active.id}
            item={item}
            index={index}
            count={active.exercises.length}
            unit={unit}
          />
        ))}

        <Button title="Add exercises" icon="add-circle-outline" variant="secondary" onPress={() => router.push('/exercise-picker')} />
        <Button title="Discard workout" variant="ghost" onPress={confirmDiscard} style={{ marginTop: space.lg }} />
      </ScrollView>

      {Platform.OS === 'ios' && (
        <InputAccessoryView nativeID={NUMERIC_ACCESSORY_ID}>
          <View style={[styles.accessory, { backgroundColor: colors.surfaceRaised, borderTopColor: colors.border }]}>
            <Pressable onPress={Keyboard.dismiss} hitSlop={8} accessibilityRole="button">
              <Text variant="headline" color="accentText">
                Done
              </Text>
            </Pressable>
          </View>
        </InputAccessoryView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: space.lg,
    paddingVertical: space.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  timer: { fontSize: 20 },
  content: { padding: space.lg, gap: space.md },
  emptyHint: {
    alignItems: 'center',
    gap: space.sm,
    padding: space.xl,
    borderWidth: 1.5,
    borderStyle: 'dashed',
    borderRadius: 16,
  },
  accessory: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    paddingHorizontal: space.lg,
    paddingVertical: space.sm + 2,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
});
