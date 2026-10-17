import { focusManager, onlineManager, QueryClient } from '@tanstack/react-query';
import * as Network from 'expo-network';
import { AppState, Platform } from 'react-native';

import { ApiError } from '@/features/api/client';

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // Retry transient failures (network, 5xx) twice; a 4xx won't fix itself on retry.
      retry: (failureCount, error) =>
        failureCount < 2 && !(error instanceof ApiError && error.status >= 400 && error.status < 500),
    },
  },
});

if (Platform.OS !== 'web') {
  // Offline: pause queries and mutations instead of failing them, and resume when the
  // connection returns (the gym basement problem).
  onlineManager.setEventListener((setOnline) => {
    const subscription = Network.addNetworkStateListener((state) => setOnline(state.isInternetReachable !== false));
    return () => subscription.remove();
  });
  // Refetch stale data when the app comes back to the foreground.
  focusManager.setEventListener((setFocused) => {
    const subscription = AppState.addEventListener('change', (status) => setFocused(status === 'active'));
    return () => subscription.remove();
  });
}
