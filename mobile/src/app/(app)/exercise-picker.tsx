/**
 * Pick one or more exercises to add to the active workout. Search filters the
 * cached list instantly, and chips narrow it by muscle group. If nothing
 * matches, the user can create a custom exercise right here.
 */
import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { FlatList, Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Button, Icon, Text } from '@/components/ui';
import { useCreateExercise, useExercises, useWeightUnit } from '@/features/api/queries';
import type { Equipment, Exercise, MuscleGroup } from '@/features/api/types';
import { useActiveWorkout } from '@/features/workout/activeWorkoutStore';
import { equipmentLabel, muscleGroupLabel } from '@/features/workout/format';
import { hitTarget, radius, space, typography } from '@/theme/tokens';
import { useTheme } from '@/theme/useTheme';

const muscleGroups = Object.keys(muscleGroupLabel) as MuscleGroup[];
const equipmentTypes = Object.keys(equipmentLabel) as Equipment[];

export default function ExercisePickerScreen() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const exercises = useExercises();
  const unit = useWeightUnit();
  const [query, setQuery] = useState('');
  const [muscle, setMuscle] = useState<MuscleGroup | null>(null);
  const [selected, setSelected] = useState<Exercise[]>([]);
  const [creating, setCreating] = useState(false);

  const results = useMemo(() => {
    const term = query.trim().toLowerCase();
    return (exercises.data ?? []).filter(
      (e) => (!muscle || e.muscleGroup === muscle) && (!term || e.name.toLowerCase().includes(term)),
    );
  }, [exercises.data, query, muscle]);

  const toggle = (exercise: Exercise) =>
    setSelected((current) =>
      current.some((e) => e.id === exercise.id) ? current.filter((e) => e.id !== exercise.id) : [...current, exercise],
    );

  const addSelected = (list = selected) => {
    useActiveWorkout.getState().addExercises(list, unit);
    router.back();
  };

  if (creating) {
    return (
      <CreateExerciseForm
        initialName={query.trim()}
        initialMuscle={muscle}
        onCancel={() => setCreating(false)}
        onCreated={(exercise) => addSelected([...selected, exercise])}
      />
    );
  }

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      <View style={styles.searchArea}>
        <View style={[styles.search, { backgroundColor: colors.surfaceRaised }]}>
          <Icon name="search" size={18} color="textTertiary" />
          <TextInput
            value={query}
            onChangeText={setQuery}
            placeholder="Search exercises"
            placeholderTextColor={colors.textTertiary}
            autoCorrect={false}
            clearButtonMode="while-editing"
            returnKeyType="search"
            style={[typography.body, styles.searchInput, { color: colors.text }]}
          />
        </View>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
          <Chip label="All" selected={!muscle} onPress={() => setMuscle(null)} />
          {muscleGroups.map((group) => (
            <Chip key={group} label={muscleGroupLabel[group]} selected={muscle === group} onPress={() => setMuscle(muscle === group ? null : group)} />
          ))}
        </ScrollView>
      </View>

      <FlatList
        data={results}
        keyExtractor={(item) => item.id}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        contentContainerStyle={{ paddingBottom: 120 + insets.bottom }}
        renderItem={({ item }) => {
          const isSelected = selected.some((e) => e.id === item.id);
          return (
            <Pressable
              onPress={() => toggle(item)}
              accessibilityRole="checkbox"
              accessibilityState={{ checked: isSelected }}
              style={({ pressed }) => [styles.item, { borderBottomColor: colors.border }, pressed && { backgroundColor: colors.surface }]}>
              <View style={{ flex: 1, gap: 2 }}>
                <Text variant="body" weight={isSelected ? '600' : '400'}>
                  {item.name}
                </Text>
                <Text variant="footnote" color="textSecondary">
                  {muscleGroupLabel[item.muscleGroup]} · {equipmentLabel[item.equipment]}
                  {item.custom ? ' · Custom' : ''}
                </Text>
              </View>
              <Icon name={isSelected ? 'checkmark-circle' : 'ellipse-outline'} size={24} color={isSelected ? 'accentText' : 'textTertiary'} />
            </Pressable>
          );
        }}
        ListEmptyComponent={
          exercises.isPending ? undefined : (
            <View style={styles.empty}>
              <Text variant="callout" color="textSecondary" align="center">
                {exercises.isError ? "Couldn't load exercises." : `No exercises match "${query}".`}
              </Text>
            </View>
          )
        }
        ListFooterComponent={
          <Pressable onPress={() => setCreating(true)} style={styles.createRow} accessibilityRole="button">
            <Icon name="add-circle-outline" size={22} color="accentText" />
            <Text variant="body" color="accentText" weight="600">
              {query.trim() ? `Create "${query.trim()}"` : 'Create custom exercise'}
            </Text>
          </Pressable>
        }
      />

      {selected.length > 0 && (
        <View style={[styles.footer, { paddingBottom: insets.bottom + space.md, backgroundColor: colors.background, borderTopColor: colors.border }]}>
          <Button
            title={`Add ${selected.length} exercise${selected.length > 1 ? 's' : ''}`}
            icon="add"
            onPress={() => addSelected()}
          />
        </View>
      )}
    </View>
  );
}

function Chip({ label, selected, onPress }: { label: string; selected: boolean; onPress: () => void }) {
  const { colors } = useTheme();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ selected }}
      style={[styles.chip, { backgroundColor: selected ? colors.accent : colors.surfaceRaised }]}>
      <Text variant="subhead" weight="600" color={selected ? 'onAccent' : 'textSecondary'}>
        {label}
      </Text>
    </Pressable>
  );
}

function CreateExerciseForm({
  initialName,
  initialMuscle,
  onCancel,
  onCreated,
}: {
  initialName: string;
  initialMuscle: MuscleGroup | null;
  onCancel: () => void;
  onCreated: (exercise: Exercise) => void;
}) {
  const { colors } = useTheme();
  const create = useCreateExercise();
  const [name, setName] = useState(initialName);
  const [muscle, setMuscle] = useState<MuscleGroup | null>(initialMuscle);
  const [equipment, setEquipment] = useState<Equipment | null>(null);

  const canSave = name.trim().length > 0 && muscle && equipment;
  const save = () => {
    if (!canSave) return;
    create.mutate({ name: name.trim(), muscleGroup: muscle, equipment }, { onSuccess: onCreated });
  };

  return (
    <ScrollView style={{ backgroundColor: colors.background }} contentContainerStyle={styles.form} keyboardShouldPersistTaps="handled">
      <Text variant="title2">New exercise</Text>
      <View style={[styles.search, { backgroundColor: colors.surfaceRaised }]}>
        <TextInput
          value={name}
          onChangeText={setName}
          placeholder="Exercise name"
          placeholderTextColor={colors.textTertiary}
          autoFocus={!initialName}
          style={[typography.body, styles.searchInput, { color: colors.text }]}
        />
      </View>
      <Text variant="footnote" weight="600" color="textSecondary">MUSCLE GROUP</Text>
      <View style={styles.wrap}>
        {muscleGroups.map((group) => (
          <Chip key={group} label={muscleGroupLabel[group]} selected={muscle === group} onPress={() => setMuscle(group)} />
        ))}
      </View>
      <Text variant="footnote" weight="600" color="textSecondary">EQUIPMENT</Text>
      <View style={styles.wrap}>
        {equipmentTypes.map((type) => (
          <Chip key={type} label={equipmentLabel[type]} selected={equipment === type} onPress={() => setEquipment(type)} />
        ))}
      </View>
      {create.error && (
        <Text variant="footnote" color="danger">
          {create.error.message}
        </Text>
      )}
      <Button title="Create and add" onPress={save} disabled={!canSave} loading={create.isPending} />
      <Button title="Back to list" variant="ghost" onPress={onCancel} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  searchArea: { paddingTop: space.sm, gap: space.sm },
  search: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    marginHorizontal: space.lg,
    paddingHorizontal: space.md,
    borderRadius: radius.md,
    minHeight: hitTarget.min,
  },
  searchInput: { flex: 1, paddingVertical: space.sm },
  chips: { gap: space.sm, paddingHorizontal: space.lg, paddingBottom: space.sm },
  chip: { paddingHorizontal: space.md, paddingVertical: space.sm - 2, borderRadius: radius.pill },
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    paddingHorizontal: space.lg,
    paddingVertical: space.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  empty: { padding: space.xl },
  createRow: { flexDirection: 'row', alignItems: 'center', gap: space.sm, padding: space.lg },
  footer: { position: 'absolute', left: 0, right: 0, bottom: 0, paddingHorizontal: space.lg, paddingTop: space.md, borderTopWidth: StyleSheet.hairlineWidth },
  form: { padding: space.lg, gap: space.md },
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
});
