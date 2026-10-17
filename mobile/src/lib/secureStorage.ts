/**
 * Secure key-value storage: the iOS Keychain / Android Keystore via
 * expo-secure-store. The web build (used only for local previews) has no
 * secure store, so it falls back to localStorage there.
 */
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

const web = Platform.OS === 'web';

export const secureStorage = {
  getItem: async (key: string): Promise<string | null> => (web ? localStorage.getItem(key) : SecureStore.getItemAsync(key)),
  setItem: async (key: string, value: string): Promise<void> =>
    web ? localStorage.setItem(key, value) : SecureStore.setItemAsync(key, value),
  deleteItem: async (key: string): Promise<void> => (web ? localStorage.removeItem(key) : SecureStore.deleteItemAsync(key)),
};
