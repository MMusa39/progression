import { SegmentedControl } from '@/components/ui';
import type { Meal } from '@/features/api/types';

import { MEALS, mealLabel } from './meals';

export function MealPicker({ value, onChange }: { value: Meal; onChange: (meal: Meal) => void }) {
  return (
    <SegmentedControl<Meal>
      accessibilityLabel="Meal"
      options={MEALS.map((m) => ({ value: m, label: m === 'SNACK' ? 'Snack' : mealLabel[m] }))}
      value={value}
      onChange={onChange}
    />
  );
}
