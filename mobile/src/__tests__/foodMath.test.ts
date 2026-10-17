import type { Food } from '@/features/api/types';
import { amountLabel, mealForNow } from '@/features/food/meals';
import { nutrientsFor } from '@/features/food/queries';

jest.mock('@/features/api/client', () => ({ apiRequest: jest.fn() }));

const oats: Food = {
  id: 'f1',
  barcode: null,
  name: 'Oats',
  brand: null,
  servingG: 40,
  servingLabel: '1/2 cup',
  per100g: { kcal: 380, proteinG: 13, carbsG: 67, fatG: 7, fiberG: 10 },
  custom: true,
};

describe('nutrientsFor', () => {
  it('scales per-100 g values by grams', () => {
    expect(nutrientsFor(oats, 50, 'G').kcal).toBeCloseTo(190);
  });

  it('converts servings to grams with the serving size', () => {
    const n = nutrientsFor(oats, 2, 'SERVING');
    expect(n.kcal).toBeCloseTo(304);
    expect(n.proteinG).toBeCloseTo(10.4);
  });
});

describe('mealForNow', () => {
  it.each([
    [7, 'BREAKFAST'],
    [12, 'LUNCH'],
    [18, 'DINNER'],
    [22, 'SNACK'],
  ])('at %i:00 suggests %s', (hour, meal) => {
    expect(mealForNow(new Date(2026, 9, 17, hour))).toBe(meal);
  });
});

describe('amountLabel', () => {
  it('formats grams and servings', () => {
    expect(amountLabel(150, 'G')).toBe('150 g');
    expect(amountLabel(2.5, 'SERVING')).toBe('2.5 servings');
    expect(amountLabel(1, 'SERVING', '1 bar')).toBe('1 bar');
    expect(amountLabel(1, 'SERVING')).toBe('1 serving');
  });
});
