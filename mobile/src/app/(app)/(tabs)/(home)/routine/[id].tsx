/**
 * Create or edit a routine: a name and an ordered list of exercises, each with
 * a number of sets and a rep range. `id=new` starts a blank routine;
 * `id=new&from=<workoutId>` copies a past workout ("Save as routine").
 */
import { randomUUID } from 'expo-crypto';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, StyleSheet, TextInput, View } from 'react-native';

import { Button, Card, Icon, Screen, Text, TextField } from '@/components/ui';
import { useWorkout } from '@/features/api/queries';
import { useDeleteRoutine, useRoutine, useSaveRoutine } from '@/features/routines/queries';
import { useRoutineDraft, type DraftRoutineExercise } from '@/features/routines/routineDraft';
import { muscleGroupLabel } from '@/features/workout/format';
import { useStartWorkout } from '@/features/workout/useStartWorkout';
import { radius, space } from '@/theme/tokens';
import { useTheme } from '@/theme/useTheme';

export default function RoutineEditorScreen() {
  const { id, from } = useLocalSearchParams<{ id: string; from?: string }>();
  const isNew = id === 'new';
  const [newId] = useState(() => randomUUID());
  const routineId = isNew ? newId : id;
  const existing = useRoutine(isNew ? undefined : id);
  const sourceWorkout = useWorkout(from ?? '');
  const save = useSaveRoutine();
  const remove = useDeleteRoutine();
  const { startRoutine } = useStartWorkout();
  const draft = useRoutineDraft();

  // Fill the draft once its source is ready: blank, a past workout, or the saved routine.
  useEffect(() => {
    const store = useRoutineDraft.getState();
    if (isNew && !from) store.load(newId);
    else if (isNew && from && sourceWorkout.data) store.loadFromWorkout(sourceWorkout.data, newId);
    else if (!isNew && existing.data) store.load(existing.data.id, existing.data);
  }, [isNew, from, newId, sourceWorkout.data, existing.data]);

  if (draft.id !== routineId) return <ActivityIndicator style={{ flex: 1 }} />;

  const ranges = draft.exercises.every((e) => e.repMin >= 1 && e.repMax >= e.repMin);
  const valid = draft.name.trim().length > 0 && draft.exercises.length > 0 && ranges;

  const submit = () =>
    save.mutate(
      {
        id: routineId,
        name: draft.name.trim(),
        exercises: draft.exercises.map((e) => ({ exerciseId: e.exercise.id, sets: e.sets, repMin: e.repMin, repMax: e.repMax })),
      },
      { onSuccess: () => router.back(), onError: (e) => Alert.alert("Couldn't save", e.message) },
    );

  const confirmDelete = () =>
    Alert.alert('Delete routine?', 'Workouts you logged from it stay in your history.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: () => remove.mutate(routineId, { onSuccess: () => router.back() }) },
    ]);

  return (
    <Screen
      edges={['bottom']}
      footer={
        <>
          <Button title="Save routine" onPress={submit} disabled={!valid} loading={save.isPending} />
          {!isNew && existing.data && (
            <View style={styles.footerRow}>
              <Button title="Start" icon="play" variant="secondary" style={{ flex: 1 }} onPress={() => startRoutine(existing.data!)} />
              <Button title="Delete" variant="ghost" style={{ flex: 1 }} onPress={confirmDelete} />
            </View>
          )}
        </>
      }>
      <Stack.Screen options={{ title: isNew ? 'New Routine' : 'Edit Routine' }} />
      <TextField label="Name" value={draft.name} onChangeText={draft.setName} placeholder="e.g. Push Day, Upper A" />

      {draft.exercises.length > 0 && (
        <Text variant="footnote" weight="600" color="textSecondary">
          EXERCISES · SETS × REP RANGE
        </Text>
      )}
      {draft.exercises.map((e, i) => (
        <ExerciseRow key={e.key} item={e} first={i === 0} last={i === draft.exercises.length - 1} />
      ))}
      <Button
        title={draft.exercises.length ? 'Add exercises' : 'Add your first exercise'}
        icon="add"
        variant="secondary"
        onPress={() => router.push({ pathname: '/exercise-picker', params: { target: 'routine' } })}
      />
      <Text variant="footnote" color="textTertiary">
        When you start this routine, each exercise suggests a weight from last time. Hit the top of the rep range on every
        set and it suggests adding weight.
      </Text>
    </Screen>
  );
}

function ExerciseRow({ item, first, last }: { item: DraftRoutineExercise; first: boolean; last: boolean }) {
  const { update, move, remove } = useRoutineDraft.getState();
  const openMenu = () =>
    Alert.alert(item.exercise.name, undefined, [
      ...(!first ? [{ text: 'Move up', onPress: () => move(item.key, -1) }] : []),
      ...(!last ? [{ text: 'Move down', onPress: () => move(item.key, 1) }] : []),
      { text: 'Remove', style: 'destructive' as const, onPress: () => remove(item.key) },
      { text: 'Cancel', style: 'cancel' as const },
    ]);

  return (
    <Card style={{ gap: space.md }}>
      <View style={styles.rowHeader}>
        <View style={{ flex: 1 }}>
          <Text variant="headline">{item.exercise.name}</Text>
          <Text variant="caption" color="textTertiary">
            {muscleGroupLabel[item.exercise.muscleGroup]}
          </Text>
        </View>
        <Pressable onPress={openMenu} hitSlop={12} accessibilityRole="button" accessibilityLabel={`${item.exercise.name} options`}>
          <Icon name="ellipsis-horizontal" size={22} color="textSecondary" />
        </Pressable>
      </View>
      <View style={styles.controls}>
        <Stepper label="Sets" value={item.sets} min={1} max={20} onChange={(sets) => update(item.key, { sets })} />
        <View style={styles.range}>
          <Text variant="caption" color="textSecondary">
            Reps
          </Text>
          <View style={styles.rangeInputs}>
            <SmallNumber value={item.repMin} onChange={(repMin) => update(item.key, { repMin })} label="Minimum reps" />
            <Text variant="body" color="textSecondary">
              –
            </Text>
            <SmallNumber value={item.repMax} onChange={(repMax) => update(item.key, { repMax })} label="Maximum reps" />
          </View>
        </View>
      </View>
      {item.repMax < item.repMin && (
        <Text variant="footnote" color="danger">
          The top of the range should be at least {item.repMin}.
        </Text>
      )}
    </Card>
  );
}

function Stepper({ label, value, min, max, onChange }: { label: string; value: number; min: number; max: number; onChange: (v: number) => void }) {
  const { colors } = useTheme();
  const button = (delta: -1 | 1, icon: 'remove' | 'add') => (
    <Pressable
      onPress={() => onChange(Math.min(max, Math.max(min, value + delta)))}
      disabled={value + delta < min || value + delta > max}
      hitSlop={6}
      accessibilityRole="button"
      accessibilityLabel={`${delta > 0 ? 'More' : 'Fewer'} ${label.toLowerCase()}`}
      style={[styles.stepButton, { backgroundColor: colors.surfaceRaised }]}>
      <Icon name={icon} size={18} color="text" />
    </Pressable>
  );
  return (
    <View style={{ gap: space.xs }}>
      <Text variant="caption" color="textSecondary">
        {label}
      </Text>
      <View style={styles.stepper}>
        {button(-1, 'remove')}
        <Text variant="headline" style={styles.stepValue}>
          {value}
        </Text>
        {button(1, 'add')}
      </View>
    </View>
  );
}

function SmallNumber({ value, onChange, label }: { value: number; onChange: (v: number) => void; label: string }) {
  const { colors } = useTheme();
  const [text, setText] = useState(String(value));
  return (
    <TextInput
      value={text}
      onChangeText={(t) => {
        const clean = t.replace(/\D/g, '').slice(0, 3);
        setText(clean);
        if (clean) onChange(Number(clean));
      }}
      keyboardType="number-pad"
      selectTextOnFocus
      accessibilityLabel={label}
      style={[styles.small, { color: colors.text, backgroundColor: colors.inputBackground, borderColor: colors.border }]}
    />
  );
}

const styles = StyleSheet.create({
  footerRow: { flexDirection: 'row', gap: space.sm },
  rowHeader: { flexDirection: 'row', alignItems: 'flex-start', gap: space.sm },
  controls: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between' },
  stepper: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  stepButton: { width: 36, height: 36, borderRadius: radius.pill, alignItems: 'center', justifyContent: 'center' },
  stepValue: { minWidth: 24, textAlign: 'center' },
  range: { gap: space.xs, alignItems: 'flex-end' },
  rangeInputs: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  small: { width: 52, minWidth: 0, height: 36, borderWidth: 1, borderRadius: radius.sm, textAlign: 'center', fontSize: 17, fontWeight: '600' },
});
