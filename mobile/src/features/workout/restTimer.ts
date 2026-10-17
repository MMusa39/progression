/**
 * Rest timer between sets. Ticking a set off starts it automatically. The
 * deadline is stored as an absolute time (not a countdown), so it stays right
 * if the app is backgrounded or reloaded, and it's persisted for the same reason.
 *
 * The default rest length is a per-device preference set in Profile.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

export const REST_OPTIONS = [0, 60, 90, 120, 180] as const; // seconds; 0 = off
export type RestOption = (typeof REST_OPTIONS)[number];

const MIN_SECONDS = 5;
const MAX_SECONDS = 15 * 60;

type RestTimerState = {
  /** Default rest after each set, in seconds; 0 disables the timer. */
  defaultSeconds: RestOption;
  /** Epoch ms when the current rest ends, or null when no rest is running. */
  endsAt: number | null;
  /** Length of the current rest in seconds (for the progress bar). */
  totalSeconds: number;

  setDefault: (seconds: RestOption) => void;
  /** Starts (or restarts) a rest using the default length. No-op when the timer is off. */
  startDefault: (now?: number) => void;
  /** Adds (or with a negative value, removes) time from the running rest. */
  adjust: (seconds: number, now?: number) => void;
  stop: () => void;
};

export const useRestTimer = create<RestTimerState>()(
  persist(
    (set, get) => ({
      defaultSeconds: 120,
      endsAt: null,
      totalSeconds: 0,

      setDefault: (seconds) => set({ defaultSeconds: seconds, ...(seconds === 0 && { endsAt: null }) }),

      startDefault: (now = Date.now()) => {
        const seconds = get().defaultSeconds;
        if (seconds === 0) return;
        set({ endsAt: now + seconds * 1000, totalSeconds: seconds });
      },

      adjust: (seconds, now = Date.now()) => {
        const { endsAt, totalSeconds } = get();
        if (endsAt === null) return;
        const remaining = Math.min(MAX_SECONDS, Math.max(MIN_SECONDS, (endsAt - now) / 1000 + seconds));
        set({ endsAt: now + remaining * 1000, totalSeconds: Math.max(totalSeconds + seconds, remaining) });
      },

      stop: () => set({ endsAt: null, totalSeconds: 0 }),
    }),
    { name: 'progression.rest-timer', storage: createJSONStorage(() => AsyncStorage) },
  ),
);

/** Whole seconds left in the rest (0 once it has ended). */
export function remainingSeconds(endsAt: number | null, now = Date.now()): number {
  return endsAt === null ? 0 : Math.max(0, Math.ceil((endsAt - now) / 1000));
}

/** "2:00", "0:45", "Off". */
export function formatRest(seconds: number): string {
  if (seconds === 0) return 'Off';
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;
}
