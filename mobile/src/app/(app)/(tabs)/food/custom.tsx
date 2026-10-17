/**
 * Create a food from its nutrition label, entered per serving, the way the
 * label prints it. Opened directly, or after scanning a barcode that isn't
 * in the database (the barcode is pre-filled, so the next scan finds it).
 */
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Alert, StyleSheet, View } from 'react-native';

import { Button, Screen, Text, TextField } from '@/components/ui';
import type { Meal } from '@/features/api/types';
import { useCreateFood } from '@/features/food/queries';
import { useRecipeDraft } from '@/features/food/recipeDraft';
import { space } from '@/theme/tokens';

export default function CustomFoodScreen() {
  const p = useLocalSearchParams<{ meal?: Meal; date?: string; barcode?: string; mode?: 'ingredient' }>();
  const create = useCreateFood();
  const [name, setName] = useState('');
  const [brand, setBrand] = useState('');
  const [servingLabel, setServingLabel] = useState('');
  const [servingG, setServingG] = useState('');
  const [kcal, setKcal] = useState('');
  const [protein, setProtein] = useState('');
  const [carbs, setCarbs] = useState('');
  const [fat, setFat] = useState('');
  const [fiber, setFiber] = useState('');
  const num = (s: string) => (s.trim() === '' ? undefined : Number(s.replace(',', '.')));
  const valid = name.trim().length > 0 && Number(servingG) > 0 && Number(kcal) >= 0 && kcal.trim() !== '';

  const submit = () =>
    create.mutate(
      {
        name: name.trim(),
        brand: brand.trim() || undefined,
        barcode: p.barcode,
        servingG: Number(servingG),
        servingLabel: servingLabel.trim() || undefined,
        perServingValues: { kcal: Number(kcal), proteinG: num(protein), carbsG: num(carbs), fatG: num(fat), fiberG: num(fiber) },
      },
      {
        onSuccess: (food) => {
          if (p.mode === 'ingredient') {
            useRecipeDraft.getState().addIngredient(food);
            router.back();
            return;
          }
          router.replace({ pathname: '/food/item', params: { foodId: food.id, meal: p.meal, date: p.date } });
        },
        onError: (e) => Alert.alert("Couldn't save", e.message),
      },
    );

  const numeric = { keyboardType: 'decimal-pad' as const };
  return (
    <Screen edges={['bottom']} footer={<Button title="Save food" onPress={submit} disabled={!valid} loading={create.isPending} />}>
      <Stack.Screen options={{ title: 'New Food' }} />
      {p.barcode && (
        <Text variant="callout" color="textSecondary">
          Barcode {p.barcode} isn&apos;t in the database yet. Add it from the label and it&apos;ll be found next time.
        </Text>
      )}
      <TextField label="Name" value={name} onChangeText={setName} placeholder="e.g. Chocolate protein bar" autoFocus />
      <TextField label="Brand (optional)" value={brand} onChangeText={setBrand} />
      <View style={styles.row}>
        <View style={styles.cell}>
          <TextField label="Serving (g or ml)" value={servingG} onChangeText={setServingG} placeholder="60" {...numeric} />
        </View>
        <View style={styles.cell}>
          <TextField label="Serving name" value={servingLabel} onChangeText={setServingLabel} placeholder="1 bar" />
        </View>
      </View>
      <Text variant="footnote" weight="600" color="textSecondary">
        PER SERVING
      </Text>
      <TextField label="Calories" value={kcal} onChangeText={setKcal} placeholder="0" {...numeric} />
      <View style={styles.row}>
        <View style={styles.cell}>
          <TextField label="Protein (g)" value={protein} onChangeText={setProtein} placeholder="0" {...numeric} />
        </View>
        <View style={styles.cell}>
          <TextField label="Carbs (g)" value={carbs} onChangeText={setCarbs} placeholder="0" {...numeric} />
        </View>
      </View>
      <View style={styles.row}>
        <View style={styles.cell}>
          <TextField label="Fat (g)" value={fat} onChangeText={setFat} placeholder="0" {...numeric} />
        </View>
        <View style={styles.cell}>
          <TextField label="Fiber (g)" value={fiber} onChangeText={setFiber} placeholder="0" {...numeric} />
        </View>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({ row: { flexDirection: 'row', gap: space.sm }, cell: { flex: 1 } });
