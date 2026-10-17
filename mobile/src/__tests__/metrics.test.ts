import type { PersonalRecord, ProgressionPoint } from '@/features/api/types';
import { change, defaultMetric, metrics } from '@/features/progress/metrics';
import { describeRecord } from '@/features/progress/records';

const point: ProgressionPoint = {
  workoutId: 'w', performedAt: '2026-10-01T18:00:00Z', bestE1rmKg: 100, topSetWeightKg: 90.718474,
  topSetReps: 5, bestReps: 8, setCount: 4,
};

describe('metrics', () => {
  it('converts kilograms into the preferred unit', () => {
    expect(metrics.topSet.value(point, 'LB')).toBeCloseTo(200, 5);
    expect(metrics.topSet.value(point, 'KG')).toBeCloseTo(90.72, 2);
    expect(metrics.e1rm.format(metrics.e1rm.value(point, 'LB'), 'LB')).toBe('220 lb');
    expect(metrics.reps.value(point, 'LB')).toBe(8);
  });

  it('defaults bodyweight movements to reps', () => {
    expect(defaultMetric('BODYWEIGHT')).toBe('reps');
    expect(defaultMetric('BARBELL')).toBe('e1rm');
    expect(defaultMetric('OTHER', { exerciseId: 'x', exerciseName: 'x', muscleGroup: 'CORE', equipment: 'OTHER', points: [{ ...point, topSetWeightKg: 0 }] })).toBe('reps');
  });

  it('computes change from first to last', () => {
    expect(change([100, 105, 110])).toEqual({ absolute: 10, percent: 10 });
    expect(change([100])).toBeNull();
    expect(change([0, 5])).toEqual({ absolute: 5, percent: null });
  });
});

describe('describeRecord', () => {
  const record: PersonalRecord = {
    exerciseId: 'e', exerciseName: 'Bench Press', type: 'HEAVIEST_WEIGHT', setId: 's',
    valueKg: 102.058, previousKg: 97.522, weight: 225, weightUnit: 'LB', reps: 3,
  };

  it('shows the set as logged and the previous best in the preferred unit', () => {
    expect(describeRecord(record, 'LB')).toEqual({ title: 'Heaviest weight: 225 lb × 3', detail: 'previous best 215 lb' });
  });

});
