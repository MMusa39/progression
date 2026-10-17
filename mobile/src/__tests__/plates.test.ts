import { describePlates, loadBar } from '@/features/workout/plates';
import { workoutsThisWeek } from '@/features/workout/weeklyGoal';

describe('loadBar', () => {
  it('loads standard pound weights', () => {
    expect(loadBar(225, 45, 'LB')).toEqual({ perSide: [45, 45], loaded: 225, shortBy: 0 });
    expect(loadBar(185, 45, 'LB').perSide).toEqual([45, 25]);
    expect(loadBar(137.5, 45, 'LB').perSide).toEqual([45]); // 46.25 per side: no 1.25 lb plates in a standard set
  });

  it('reports weights that can’t be made exactly', () => {
    const load = loadBar(137.5, 45, 'LB');
    expect(load.loaded).toBe(135);
    expect(load.shortBy).toBe(2.5);
  });

  it('loads kilograms including small plates', () => {
    expect(loadBar(102.5, 20, 'KG').perSide).toEqual([25, 15, 1.25]);
    expect(loadBar(102.5, 20, 'KG').shortBy).toBe(0);
  });

  it('handles the empty bar and targets below it', () => {
    expect(loadBar(45, 45, 'LB')).toEqual({ perSide: [], loaded: 45, shortBy: 0 });
    expect(loadBar(30, 45, 'LB')).toEqual({ perSide: [], loaded: 45, shortBy: 0 });
  });
});

describe('describePlates', () => {
  it('groups repeated plates', () => {
    expect(describePlates([45, 45, 10, 2.5])).toBe('2 × 45, 10, 2.5');
    expect(describePlates([])).toBe('Just the bar');
  });
});

describe('workoutsThisWeek', () => {
  it('counts workouts since Monday, local time', () => {
    const now = new Date(2026, 9, 17, 12); // Saturday
    const at = (d: number, h = 18) => ({ startedAt: new Date(2026, 9, d, h).toISOString() });
    expect(workoutsThisWeek([at(17), at(14), at(12, 6), at(11, 23)], now)).toBe(3);
  });
});
