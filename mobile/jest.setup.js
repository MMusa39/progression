// In-memory AsyncStorage so persisted zustand stores work under Jest.
jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);

// Deterministic, dependency-free UUIDs for the workout store.
jest.mock('expo-crypto', () => {
  let counter = 0;
  return { randomUUID: () => `00000000-0000-4000-8000-${String(++counter).padStart(12, '0')}` };
});
