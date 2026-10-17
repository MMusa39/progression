/**
 * The user's control over their data: export everything, or delete the account.
 */
import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';

import { apiRequest } from '@/features/api/client';
import * as cognito from '@/features/auth/cognito';
import { authSession } from '@/features/auth/session';
import { localDate } from '@/lib/dates';

/**
 * Downloads everything the account has stored and opens the share sheet, so it
 * can be saved to Files, AirDropped or emailed.
 *
 * @returns false where sharing isn't available (e.g. the web preview)
 */
export async function exportData(): Promise<boolean> {
  if (!(await Sharing.isAvailableAsync())) return false;
  const data = await apiRequest<unknown>('/api/v1/me/export');
  const file = new File(Paths.cache, `progression-export-${localDate()}.json`);
  if (file.exists) file.delete();
  file.create();
  file.write(JSON.stringify(data, null, 2));
  await Sharing.shareAsync(file.uri, { mimeType: 'application/json', UTI: 'public.json', dialogTitle: 'Your Progression data' });
  return true;
}

/**
 * Permanently deletes the account: all data on our server first, then the
 * sign-in identity, then the local session.
 *
 * Server data goes first on purpose. If the identity deletion then fails (say,
 * the network drops), signing in again just finds an empty account. The other
 * order could leave data behind with no way to sign in and delete it.
 */
export async function deleteAccount(): Promise<void> {
  await apiRequest<void>('/api/v1/me', { method: 'DELETE' });
  const state = authSession.getState();
  if (state.status === 'signedIn' && state.user.provider !== 'dev') {
    try {
      await cognito.deleteUser(await authSession.getAccessToken());
    } catch {
      // Data is already gone; a leftover identity only means a fresh, empty account on next sign-in.
    }
  }
  await authSession.signOut();
}
