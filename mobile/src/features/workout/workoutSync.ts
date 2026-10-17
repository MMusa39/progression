/**
 * Upload queue for finished workouts.
 *
 * Finishing a workout never waits on the network: the workout goes into this
 * persisted queue and is uploaded in the background. If the upload fails (no
 * signal at the gym), it stays queued and is retried when the app returns to
 * the foreground. Retrying is always safe because PUT /workouts/{id} is
 * idempotent.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { QueryClient } from '@tanstack/react-query';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

import { ApiError, apiRequest } from '@/features/api/client';
import { queryKeys } from '@/features/api/queries';
import type { Workout, WorkoutRequest } from '@/features/api/types';

type PendingUpload = { id: string; request: WorkoutRequest };

type SyncState = {
  pending: PendingUpload[];
  syncing: boolean;
  enqueue: (upload: PendingUpload) => void;
  /** Uploads everything in the queue; resolves when the attempt is done. */
  flush: (queryClient: QueryClient) => Promise<void>;
  clear: () => void;
};

export const useWorkoutSync = create<SyncState>()(
  persist(
    (set, get) => ({
      pending: [],
      syncing: false,

      enqueue: (upload) =>
        set(({ pending }) => ({ pending: [...pending.filter((p) => p.id !== upload.id), upload] })),

      flush: async (queryClient) => {
        if (get().syncing || get().pending.length === 0) return;
        set({ syncing: true });
        try {
          for (const upload of get().pending) {
            try {
              const saved = await apiRequest<Workout>(`/api/v1/workouts/${upload.id}`, {
                method: 'PUT',
                body: upload.request,
              });
              queryClient.setQueryData(queryKeys.workout(saved.id), saved);
              set(({ pending }) => ({ pending: pending.filter((p) => p.id !== upload.id) }));
            } catch (error) {
              // 4xx other than 409 means the server will never accept this payload,
              // so drop it rather than retry forever. 409 means the server already
              // has a newer copy. Network errors and 5xx stay queued for the next attempt.
              if (error instanceof ApiError && error.status >= 400 && error.status < 500 && error.status !== 401) {
                set(({ pending }) => ({ pending: pending.filter((p) => p.id !== upload.id) }));
                continue;
              }
              break;
            }
          }
        } finally {
          set({ syncing: false });
          queryClient.invalidateQueries({ queryKey: queryKeys.workouts });
          queryClient.invalidateQueries({ queryKey: ['last-performance'] });
          queryClient.invalidateQueries({ queryKey: queryKeys.stats });
        }
      },

      clear: () => set({ pending: [] }),
    }),
    {
      name: 'progression.workout-sync',
      storage: createJSONStorage(() => AsyncStorage),
      partialize: ({ pending }) => ({ pending }),
    },
  ),
);
