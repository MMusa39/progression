import { StyleSheet, View } from 'react-native';

import { Card, Text } from '@/components/ui';
import type { Nutrients } from '@/features/api/types';
import { space } from '@/theme/tokens';

/** Calories and macros for the amount being entered, updating as you type. */
export function NutritionPreview({ nutrients }: { nutrients: Nutrients }) {
  return (
    <Card style={styles.card}>
      <View style={{ flex: 1.2 }}>
        <Text variant="caption" color="textSecondary">
          CALORIES
        </Text>
        <Text style={styles.kcal}>{Math.round(nutrients.kcal)}</Text>
      </View>
      <Macro label="Protein" grams={nutrients.proteinG} />
      <Macro label="Carbs" grams={nutrients.carbsG} />
      <Macro label="Fat" grams={nutrients.fatG} />
    </Card>
  );
}

function Macro({ label, grams }: { label: string; grams: number }) {
  return (
    <View style={{ flex: 1 }}>
      <Text variant="caption" color="textSecondary">
        {label}
      </Text>
      <Text variant="headline">{Math.round(grams * 10) / 10} g</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { flexDirection: 'row', alignItems: 'flex-end', gap: space.sm },
  kcal: { fontSize: 32, lineHeight: 38, fontWeight: '800' },
});
