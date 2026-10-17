import type { WorkoutSet } from '@/features/api/types';
import { formatHint, overloadHint, weightIncrement } from '@/features/workout/overload';

let n = 0;
const set = (weight: number, reps: number, setType: WorkoutSet['setType'] = 'WORKING', weightUnit: WorkoutSet['weightUnit'] = 'LB'): WorkoutSet => ({
  id: String(n++),
  setType,
  weight,
  weightUnit,
  reps,
  rpe: null,
  completedAt: null,
});

describe('with a routine rep range (double progression)', () => {
  const range = { repMin: 6, repMax: 8 };

  it('adds weight once every set reaches the top of the range', () => {
    const hint = overloadHint([set(135, 10, 'WARMUP'), set(185, 8), set(185, 8), set(185, 9)], 'BARBELL', range);
    expect(hint).toMatchObject({ kind: 'add-weight', weight: 190, reps: 6 });
    expect(hint!.reason).toBe('You hit 8 reps on all 3 sets last time');
  });

  it('keeps the weight and adds a rep until then', () => {
    expect(overloadHint([set(185, 8), set(185, 7), set(185, 6)], 'BARBELL', range)).toMatchObject({
      kind: 'add-reps',
      weight: 185,
      reps: 7,
    });
  });
});

describe('without a range', () => {
  it('adds weight when every set matched the first set', () => {
    expect(overloadHint([set(60, 10, 'WORKING', 'KG'), set(60, 10, 'WORKING', 'KG')], 'BARBELL')).toMatchObject({
      kind: 'add-weight',
      weight: 62.5,
      reps: 10,
      unit: 'KG',
    });
  });

  it('asks to match the first set when reps dropped off', () => {
    expect(overloadHint([set(185, 8), set(185, 6)], 'BARBELL')).toMatchObject({ kind: 'add-reps', weight: 185, reps: 7 });
  });

  it('only judges the heaviest sets', () => {
    expect(overloadHint([set(185, 5), set(165, 3)], 'BARBELL')).toMatchObject({ kind: 'add-weight', weight: 190 });
  });
});

describe('special cases', () => {
  it('progresses bodyweight exercises by reps', () => {
    expect(overloadHint([set(0, 10), set(0, 9)], 'BODYWEIGHT')).toMatchObject({ kind: 'add-reps', reps: 10 });
  });

  it('needs working sets', () => {
    expect(overloadHint([set(95, 10, 'WARMUP')], 'BARBELL')).toBeNull();
    expect(overloadHint([], 'BARBELL')).toBeNull();
  });

  it('uses smaller kg jumps for dumbbells', () => {
    expect(weightIncrement('DUMBBELL', 'KG')).toBe(2);
    expect(weightIncrement('BARBELL', 'KG')).toBe(2.5);
    expect(weightIncrement('MACHINE', 'LB')).toBe(5);
  });

  it('formats a hint', () => {
    expect(formatHint({ kind: 'add-weight', weight: 190, reps: 6, unit: 'LB', reason: '' })).toBe('190 lb × 6');
  });
});
