import { useActiveWorkout } from '@/features/workout/activeWorkoutStore';

const bench = { id: 'bench-id', name: 'Bench Press', muscleGroup: 'CHEST' as const, equipment: 'BARBELL' as const };
const squat = { id: 'squat-id', name: 'Back Squat', muscleGroup: 'QUADS' as const, equipment: 'BARBELL' as const };

const store = () => useActiveWorkout.getState();
const active = () => store().active!;

beforeEach(() => {
  store().discard();
  store().start({ name: 'Push Day', unit: 'LB' });
});

describe('active workout store', () => {
  it('adds exercises with one empty set each', () => {
    store().addExercises([bench, squat], 'LB');

    expect(active().exercises.map((e) => e.exercise.name)).toEqual(['Bench Press', 'Back Squat']);
    expect(active().exercises[0].sets).toHaveLength(1);
    expect(active().exercises[0].sets[0]).toMatchObject({ weight: '', reps: '', weightUnit: 'LB', completedAt: null });
  });

  it('completes a blank set using the suggestion', () => {
    store().addExercises([bench], 'LB');
    const exercise = active().exercises[0];

    const ok = store().toggleComplete(exercise.id, exercise.sets[0].id, { weight: '185', reps: '8' });

    expect(ok).toBe(true);
    expect(active().exercises[0].sets[0]).toMatchObject({ weight: '185', reps: '8' });
    expect(active().exercises[0].sets[0].completedAt).not.toBeNull();
  });

  it('refuses to complete a set with nothing to record', () => {
    store().addExercises([bench], 'LB');
    const exercise = active().exercises[0];

    expect(store().toggleComplete(exercise.id, exercise.sets[0].id)).toBe(false);
    expect(active().exercises[0].sets[0].completedAt).toBeNull();
  });

  it('un-completes a set when toggled twice', () => {
    store().addExercises([bench], 'LB');
    const { id, sets } = active().exercises[0];
    store().toggleComplete(id, sets[0].id, { weight: '135', reps: '10' });
    store().toggleComplete(id, sets[0].id);

    expect(active().exercises[0].sets[0].completedAt).toBeNull();
    expect(active().exercises[0].sets[0].weight).toBe('135'); // values are kept for editing
  });

  it('reorders exercises within bounds', () => {
    store().addExercises([bench, squat], 'LB');
    const squatEntry = active().exercises[1];

    store().moveExercise(squatEntry.id, -1);
    expect(active().exercises[0].exercise.name).toBe('Back Squat');

    store().moveExercise(squatEntry.id, -1); // already first: no-op
    expect(active().exercises[0].exercise.name).toBe('Back Squat');
  });

  it('finish() keeps only completed sets, drops empty exercises, and clears the workout', () => {
    store().addExercises([bench, squat], 'LB');
    const benchEntry = active().exercises[0];
    store().addSet(benchEntry.id);
    const [first, second] = active().exercises[0].sets;
    store().updateSet(benchEntry.id, first.id, { weight: '185', reps: '8' });
    store().toggleComplete(benchEntry.id, first.id);
    store().updateSet(benchEntry.id, second.id, { weight: '185' }); // never completed

    const result = store().finish();

    expect(store().active).toBeNull();
    expect(result?.request.name).toBe('Push Day');
    expect(result?.request.exercises).toHaveLength(1);
    expect(result?.request.exercises[0]).toMatchObject({
      exerciseId: 'bench-id',
      sets: [expect.objectContaining({ id: first.id, weight: 185, reps: 8, weightUnit: 'LB', setType: 'WORKING' })],
    });
    expect(result?.request.endedAt).not.toBeNull();
  });

  it('accepts a comma as the decimal separator', () => {
    store().addExercises([bench], 'KG');
    const { id, sets } = active().exercises[0];
    store().updateSet(id, sets[0].id, { weight: '82,5', reps: '5' });
    store().toggleComplete(id, sets[0].id);

    expect(store().finish()?.request.exercises[0].sets[0].weight).toBe(82.5);
  });

  it('repeating a past workout copies exercises and set types with blank values', () => {
    store().discard();
    store().start({
      unit: 'LB',
      from: {
        id: 'w1', name: 'Leg Day', startedAt: '', endedAt: null, notes: null, updatedAt: '',
        exercises: [{
          id: 'we1', exerciseId: 'squat-id', exerciseName: 'Back Squat', muscleGroup: 'QUADS', equipment: 'BARBELL', notes: null,
          sets: [
            { id: 's1', setType: 'WARMUP', weight: 135, weightUnit: 'LB', reps: 5, rpe: null, completedAt: null },
            { id: 's2', setType: 'WORKING', weight: 225, weightUnit: 'LB', reps: 5, rpe: null, completedAt: null },
          ],
        }],
      },
    });

    expect(active().name).toBe('Leg Day');
    expect(active().exercises[0].sets.map((s) => [s.setType, s.weight])).toEqual([['WARMUP', ''], ['WORKING', '']]);
    expect(active().exercises[0].sets[0].id).not.toBe('s1'); // new ids: this is a new workout
  });

  it('editing a saved workout keeps its ids, sets and end time', () => {
    store().discard();
    store().edit({
      id: 'saved-workout', name: 'Push Day', startedAt: '2026-10-01T18:00:00.000Z', endedAt: '2026-10-01T19:05:00.000Z',
      notes: null, updatedAt: '2026-10-01T19:05:00.000Z',
      exercises: [{
        id: 'we1', exerciseId: 'bench-id', exerciseName: 'Bench Press', muscleGroup: 'CHEST', equipment: 'BARBELL', notes: null,
        sets: [{ id: 's1', setType: 'WORKING', weight: 185, weightUnit: 'LB', reps: 8, rpe: null, completedAt: '2026-10-01T18:10:00.000Z' }],
      }],
    });

    expect(active().editing).toEqual({ endedAt: '2026-10-01T19:05:00.000Z' });
    store().updateSet('we1', 's1', { reps: '9' }); // fix a typo

    const result = store().finish();
    expect(result?.id).toBe('saved-workout');
    expect(result?.request.endedAt).toBe('2026-10-01T19:05:00.000Z'); // not "now"
    expect(result?.request.exercises[0].sets[0]).toMatchObject({ id: 's1', reps: 9, weight: 185 });
  });

  it('carries last session\'s note in once, and a cleared note stays cleared', () => {
    store().addExercises([bench], 'LB');
    const id = active().exercises[0].id;

    store().seedNotes(id, 'Seat at 4');
    expect(active().exercises[0].notes).toBe('Seat at 4');

    store().setNotes(id, '');
    store().seedNotes(id, 'Seat at 4'); // e.g. the query refetches
    expect(active().exercises[0].notes).toBe('');
  });

  it('starts a routine with its planned sets and targets', () => {
    store().start({
      unit: 'KG',
      routine: {
        id: 'r1',
        name: 'Upper A',
        notes: null,
        exercises: [{ exerciseId: 'bench-id', exerciseName: 'Bench Press', muscleGroup: 'CHEST', equipment: 'BARBELL', sets: 3, repMin: 6, repMax: 8 }],
      },
    });
    expect(active().name).toBe('Upper A');
    expect(active().exercises[0].sets).toHaveLength(3);
    expect(active().exercises[0].sets[0].weightUnit).toBe('KG');
    expect(active().exercises[0].target).toEqual({ sets: 3, repMin: 6, repMax: 8 });
  });
});
