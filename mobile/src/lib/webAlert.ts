/**
 * Development aid for the web preview: React Native's Alert does nothing on
 * web, so confirmations (Finish workout, Delete, …) would be dead ends there.
 * This maps them to the browser's dialogs. It never runs on a phone.
 *
 * With two or more buttons, OK picks the first non-cancel button, so menus
 * with several actions only expose their first one on web.
 */
import { Alert, Platform, type AlertButton } from 'react-native';

export function installWebAlert() {
  if (Platform.OS !== 'web' || !__DEV__ || typeof window === 'undefined') return;
  Alert.alert = (title: string, message?: string, buttons?: AlertButton[]) => {
    const text = [title, message].filter(Boolean).join('\n\n');
    const actions = buttons ?? [];
    const cancel = actions.find((b) => b.style === 'cancel');
    const primary = actions.find((b) => b.style !== 'cancel');
    if (!primary) {
      window.alert(text);
      cancel?.onPress?.();
      return;
    }
    if (actions.length === 1) {
      window.alert(text);
      primary.onPress?.();
      return;
    }
    if (window.confirm(`${text}\n\nOK = ${primary.text}`)) primary.onPress?.();
    else cancel?.onPress?.();
  };
}
