/** Log calories (and optionally macros) without picking a food, e.g. a restaurant meal. */
import { randomUUID } from 'expo-crypto';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Alert, StyleSheet, View } from 'react-native';

import { Button, Screen, Text, TextField } from '@/components/ui';
import type { Meal } from '@/features/api/types';
import { MealPicker } from '@/features/food/MealPicker';
import { mealForNow } from '@/features/food/meals';
import { useSaveEntry } from '@/features/food/queries';
import { localDate } from '@/lib/dates';
import { space } from '@/theme/tokens';

export default function QuickAddScreen() {
  const p = useLocalSearchParams<{ meal?: Meal; date?: string }>();
  const save = useSaveEntry();
  const [meal, setMeal] = useState<Meal>(p.meal ?? mealForNow());
  const [name, setName] = useState('');
  const [kcal, setKcal] = useState('');
  const [protein, setProtein] = useState('');
  const [carbs, setCarbs] = useState('');
  const [fat, setFat] = useState('');
  const num = (s: string) => (s.trim() === '' ? undefined : Number(s.replace(',', '.')));
  const valid = Number(kcal) > 0 && Number(kcal) <= 10_000;

  const submit = () =>
    save.mutate(
      {
        id: randomUUID(),
        entry: {
          date: p.date ?? localDate(),
          meal,
          kind: 'QUICK',
          amount: 1,
          amountUnit: 'SERVING',
          quick: { name: name.trim() || undefined, kcal: Number(kcal), proteinG: num(protein), carbsG: num(carbs), fatG: num(fat) },
        },
      },
      { onSuccess: () => router.dismissTo('/food'), onError: (e) => Alert.alert("Couldn't save", e.message) },
    );

  const numeric = { keyboardType: 'decimal-pad' as const, returnKeyType: 'done' as const };
  return (
    <Screen edges={['bottom']} footer={<Button title="Log" onPress={submit} disabled={!valid} loading={save.isPending} />}>
      <Stack.Screen options={{ title: 'Quick Add' }} />
      <Text variant="callout" color="textSecondary">
        When you know the calories but not the food. Macros are optional.
      </Text>
      <TextField label="Name (optional)" value={name} onChangeText={setName} placeholder="e.g. Burrito bowl" />
      <TextField label="Calories" value={kcal} onChangeText={setKcal} placeholder="0" {...numeric} />
      <View style={styles.row}>
        <View style={styles.cell}>
          <TextField label="Protein (g)" value={protein} onChangeText={setProtein} placeholder="—" {...numeric} />
        </View>
        <View style={styles.cell}>
          <TextField label="Carbs (g)" value={carbs} onChangeText={setCarbs} placeholder="—" {...numeric} />
        </View>
        <View style={styles.cell}>
          <TextField label="Fat (g)" value={fat} onChangeText={setFat} placeholder="—" {...numeric} />
        </View>
      </View>
      <MealPicker value={meal} onChange={setMeal} />
    </Screen>
  );
}

const styles = StyleSheet.create({ row: { flexDirection: 'row', gap: space.sm }, cell: { flex: 1 } });
