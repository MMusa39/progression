/**
 * "Continue with Google" through Cognito's hosted OAuth 2.0 endpoints.
 *
 * Flow (authorization code + PKCE):
 *  1. Open the system browser at Cognito's /oauth2/authorize with
 *     `identity_provider=Google`, which forwards straight to Google's account picker.
 *  2. Google authenticates the user and redirects to Cognito, which creates or
 *     updates the Cognito user and redirects back to the app with a one-time `code`.
 *  3. The app exchanges the code plus the PKCE verifier at /oauth2/token for
 *     Cognito tokens, the same kind of tokens email/phone users get.
 *
 * PKCE matters because the app has no client secret: only the app instance
 * that started the flow knows the verifier, so a stolen code is useless.
 */
import { exchangeCodeAsync, makeRedirectUri, useAuthRequest, type DiscoveryDocument } from 'expo-auth-session';
import * as WebBrowser from 'expo-web-browser';
import { useCallback, useState } from 'react';

import { env } from '@/config/env';

import { authSession } from './session';

// Closes the auth popup when running on web; a no-op on iOS/Android.
WebBrowser.maybeCompleteAuthSession();

const discovery: DiscoveryDocument = {
  authorizationEndpoint: `${env.cognito.domain}/oauth2/authorize`,
  tokenEndpoint: `${env.cognito.domain}/oauth2/token`,
  revocationEndpoint: `${env.cognito.domain}/oauth2/revoke`,
};

/**
 * `progression://auth` in builds, `exp://<your-ip>:8081/--/auth` in Expo Go.
 * Whichever it is must be registered as a callback URL on the Cognito app client.
 */
export const googleRedirectUri = makeRedirectUri({ scheme: 'progression', path: 'auth' });

if (__DEV__ && env.googleEnabled) {
  // Register this exact URL with Cognito: cdk deploy -c devCallbackUrls=<this value>
  console.info(`[auth] Google redirect URI: ${googleRedirectUri}`);
}

export function useGoogleSignIn() {
  const [request, , promptAsync] = useAuthRequest(
    {
      clientId: env.cognito.clientId,
      redirectUri: googleRedirectUri,
      scopes: ['openid', 'email', 'profile', 'phone'],
      usePKCE: true,
      extraParams: { identity_provider: 'Google' },
    },
    discovery,
  );
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const signIn = useCallback(async () => {
    if (!request) return;
    setError(null);
    setLoading(true);
    try {
      const result = await promptAsync();
      if (result.type !== 'success') {
        if (result.type === 'error') setError(result.error?.message ?? 'Google sign-in failed.');
        return; // 'cancel' / 'dismiss': the user closed the sheet. Not an error.
      }
      const tokens = await exchangeCodeAsync(
        {
          clientId: env.cognito.clientId,
          code: result.params.code,
          redirectUri: googleRedirectUri,
          extraParams: { code_verifier: request.codeVerifier ?? '' },
        },
        discovery,
      );
      await authSession.signIn(
        {
          accessToken: tokens.accessToken,
          idToken: tokens.idToken,
          refreshToken: tokens.refreshToken,
          expiresIn: tokens.expiresIn ?? 3600,
        },
        'google',
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Google sign-in failed.');
    } finally {
      setLoading(false);
    }
  }, [promptAsync, request]);

  return { signIn, loading, error, ready: Boolean(request) };
}
