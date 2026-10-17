import { useQueryClient } from '@tanstack/react-query';
import { router } from 'expo-router';
import { Alert } from 'react-native';

import { apiRequest } from '@/features/api/client';
import { queryKeys, useWeightUnit } from '@/features/api/queries';
import type { Workout } from '@/features/api/types';

import { useActiveWorkout } from './activeWorkoutStore';

/**
 * Starts a workout (empty, or repeating a past one) and opens the logger.
 * If a workout is already in progress, asks before replacing it.
 */
export function useStartWorkout() {
  const queryClient = useQueryClient();
  const unit = useWeightUnit();

  const begin = (from?: Workout) => {
    useActiveWorkout.getState().start({ from, unit });
    router.push('/workout');
  };

  const confirmReplace = (onConfirm: () => void) => {
    if (!useActiveWorkout.getState().active) return onConfirm();
    Alert.alert('Workout in progress', 'Discard your current workout and start a new one?', [
      { text: 'Resume current', onPress: () => router.push('/workout') },
      { text: 'Discard & start new', style: 'destructive', onPress: onConfirm },
      { text: 'Cancel', style: 'cancel' },
    ]);
  };

  return {
    /** Opens a saved workout in the logger. Refuses while another workout is in progress. */
    editSaved: (workout: Workout) => {
      if (useActiveWorkout.getState().active) {
        Alert.alert('Workout in progress', 'Finish or discard your current workout before editing a past one.', [
          { text: 'Go to current workout', onPress: () => router.push('/workout') },
          { text: 'OK', style: 'cancel' },
        ]);
        return;
      }
      useActiveWorkout.getState().edit(workout);
      router.push('/workout');
    },
    startEmpty: () => confirmReplace(() => begin()),
    repeat: (workoutId: string) =>
      confirmReplace(async () => {
        try {
          const workout = await queryClient.fetchQuery({
            queryKey: queryKeys.workout(workoutId),
            queryFn: () => apiRequest<Workout>(`/api/v1/workouts/${workoutId}`),
          });
          begin(workout);
        } catch {
          Alert.alert("Couldn't load that workout", 'Check your connection and try again.');
        }
      }),
  };
}
