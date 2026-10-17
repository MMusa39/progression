/**
 * Plate math: which plates go on each side of the bar for a target weight.
 * Greedy from the heaviest plate is exact for standard plate sets.
 */
import type { WeightUnit } from '@/features/api/types';

export const PLATES: Record<WeightUnit, number[]> = {
  LB: [45, 35, 25, 10, 5, 2.5],
  KG: [25, 20, 15, 10, 5, 2.5, 1.25],
};

/** Common bars: Olympic men's/women's, and an empty "no bar" option for machines like the Smith. */
export const BARS: Record<WeightUnit, number[]> = { LB: [45, 35, 0], KG: [20, 15, 0] };

export type PlateLoad = {
  /** Plates for one side, heaviest first. */
  perSide: number[];
  /** Total actually on the bar (can be below the target if it isn't loadable). */
  loaded: number;
  /** Target minus loaded: > 0 when the exact weight can't be made with these plates. */
  shortBy: number;
};

export function loadBar(target: number, bar: number, unit: WeightUnit): PlateLoad {
  let perSideWeight = Math.max(0, (target - bar) / 2);
  const perSide: number[] = [];
  for (const plate of PLATES[unit]) {
    while (perSideWeight + 1e-9 >= plate) {
      perSide.push(plate);
      perSideWeight -= plate;
    }
  }
  const loaded = bar + 2 * perSide.reduce((sum, p) => sum + p, 0);
  return { perSide, loaded, shortBy: Math.round((Math.max(target, bar) - loaded) * 100) / 100 };
}

/** [45, 45, 10] → "2 × 45, 10". */
export function describePlates(perSide: number[]): string {
  if (perSide.length === 0) return 'Just the bar';
  const counts = new Map<number, number>();
  for (const p of perSide) counts.set(p, (counts.get(p) ?? 0) + 1);
  return [...counts.entries()].map(([plate, n]) => (n > 1 ? `${n} × ${plate}` : `${plate}`)).join(', ');
}
