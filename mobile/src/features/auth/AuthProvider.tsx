import { useEffect, useSyncExternalStore, type ReactNode } from 'react';

import { authSession, type SessionState } from './session';

/** Restores the saved session once at startup. Render it near the root of the app. */
export function AuthProvider({ children }: { children: ReactNode }) {
  useEffect(() => {
    authSession.load();
  }, []);
  return children;
}

/** The current session state; re-renders when the user signs in or out. */
export function useSession(): SessionState {
  return useSyncExternalStore(authSession.subscribe, authSession.getState);
}
