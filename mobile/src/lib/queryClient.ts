import { QueryClient } from '@tanstack/react-query';

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
