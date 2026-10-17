/**
 * Development-only sign-in: asks the local API (`local` profile) to mint a
 * token via POST /dev/token. Lets you use the whole app before Cognito is
 * deployed. Never available in production builds (`env.devAuthEnabled`).
 */
import { env } from '@/config/env';

import { authSession } from './session';

export async function signInWithDevAccount(subject = 'dev-user'): Promise<void> {
  let response: Response;
  try {
    response = await fetch(`${env.apiUrl}/dev/token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ subject, email: `${subject}@progression.dev` }),
    });
  } catch {
    throw new Error(`Can't reach the API at ${env.apiUrl}. Is the backend running (./gradlew bootRun)?`);
  }
  if (!response.ok) {
    throw new Error(`The API refused to issue a dev token (HTTP ${response.status}). Is it running with the local profile?`);
  }
  const { accessToken, expiresAt } = (await response.json()) as { accessToken: string; expiresAt: string };
  const expiresIn = Math.floor((new Date(expiresAt).getTime() - Date.now()) / 1000);
  await authSession.signIn({ accessToken, expiresIn }, 'dev');
}
