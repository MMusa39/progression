import { useCallback, useEffect, useState } from 'react';
import { AppState } from 'react-native';

import { permissionState, type PermissionState } from './notifications';

/**
 * Current notification permission, re-checked whenever the app returns to the
 * foreground (the user may have changed it in iOS Settings).
 */
export function usePermissionState() {
  const [state, setState] = useState<PermissionState | null>(null);
  const refresh = useCallback(() => {
    permissionState().then(setState).catch(() => setState('denied'));
  }, []);

  useEffect(() => {
    refresh();
    const subscription = AppState.addEventListener('change', (s) => s === 'active' && refresh());
    return () => subscription.remove();
  }, [refresh]);

  return { state, refresh };
}
