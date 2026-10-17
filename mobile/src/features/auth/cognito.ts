/**
 * Amazon Cognito user pool API, called directly over HTTPS.
 *
 * The mobile app is a *public* client (no client secret), so these calls need
 * no AWS credentials or request signing. Each one is a POST of JSON to the
 * regional endpoint, with the operation named in the `X-Amz-Target` header. This
 * keeps the app free of the large AWS SDK and works in Expo Go.
 *
 * API reference: https://docs.aws.amazon.com/cognito-user-identity-pools/latest/APIReference/
 */
import { env } from '@/config/env';

import type { TokenSet } from './session';

/** Error returned by Cognito, e.g. `UsernameExistsException`. */
export class CognitoError extends Error {
  constructor(
    readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = 'CognitoError';
  }
}

/** Where a verification code was sent, e.g. `{ medium: 'EMAIL', destination: 'j***@g***' }`. */
export type CodeDelivery = { medium: 'EMAIL' | 'SMS'; destination: string };

type AuthenticationResult = {
  AccessToken: string;
  IdToken?: string;
  RefreshToken?: string;
  ExpiresIn: number;
};

type RawCodeDelivery = { DeliveryMedium: 'EMAIL' | 'SMS'; Destination: string } | undefined;

async function call<T>(operation: string, body: Record<string, unknown>): Promise<T> {
  if (!env.cognitoEnabled) {
    throw new CognitoError('NotConfigured', 'Sign-in is not configured for this build.');
  }
  let response: Response;
  try {
    response = await fetch(`https://cognito-idp.${env.cognito.region}.amazonaws.com/`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-amz-json-1.1',
        'X-Amz-Target': `AWSCognitoIdentityProviderService.${operation}`,
      },
      body: JSON.stringify({ ClientId: env.cognito.clientId, ...body }),
    });
  } catch {
    throw new CognitoError('NetworkError', 'Could not reach the sign-in service. Check your connection.');
  }

  const json = (await response.json().catch(() => ({}))) as Record<string, unknown>;
  if (!response.ok) {
    // `__type` is either "UsernameExistsException" or "com.amazonaws...#UsernameExistsException".
    const code = String(json.__type ?? 'UnknownError').split('#').pop()!;
    throw new CognitoError(code, String(json.message ?? json.Message ?? 'Something went wrong.'));
  }
  return json as T;
}

const toDelivery = (raw: RawCodeDelivery): CodeDelivery | undefined =>
  raw && { medium: raw.DeliveryMedium, destination: raw.Destination };

const toTokens = (result: AuthenticationResult): TokenSet => ({
  accessToken: result.AccessToken,
  idToken: result.IdToken,
  refreshToken: result.RefreshToken,
  expiresIn: result.ExpiresIn,
});

/**
 * Registers a new user. `username` is the email address or E.164 phone number
 * (the pool uses them as username attributes). Cognito then sends a
 * verification code to it.
 */
export async function signUp(username: string, password: string): Promise<{ confirmed: boolean; delivery?: CodeDelivery }> {
  const attribute = username.startsWith('+') ? 'phone_number' : 'email';
  const result = await call<{ UserConfirmed: boolean; CodeDeliveryDetails?: RawCodeDelivery }>('SignUp', {
    Username: username,
    Password: password,
    UserAttributes: [{ Name: attribute, Value: username }],
  });
  return { confirmed: result.UserConfirmed, delivery: toDelivery(result.CodeDeliveryDetails) };
}

export async function confirmSignUp(username: string, code: string): Promise<void> {
  await call('ConfirmSignUp', { Username: username, ConfirmationCode: code });
}

export async function resendSignUpCode(username: string): Promise<CodeDelivery | undefined> {
  const result = await call<{ CodeDeliveryDetails?: RawCodeDelivery }>('ResendConfirmationCode', { Username: username });
  return toDelivery(result.CodeDeliveryDetails);
}

/**
 * Signs in with email/phone and password (USER_PASSWORD_AUTH). The password
 * goes to Cognito over TLS. Our API never sees it.
 */
export async function signIn(username: string, password: string): Promise<TokenSet> {
  const result = await call<{ AuthenticationResult?: AuthenticationResult; ChallengeName?: string }>('InitiateAuth', {
    AuthFlow: 'USER_PASSWORD_AUTH',
    AuthParameters: { USERNAME: username, PASSWORD: password },
  });
  if (!result.AuthenticationResult) {
    // MFA and other challenges aren't enabled on the pool, so this means misconfiguration.
    throw new CognitoError(result.ChallengeName ?? 'UnexpectedChallenge', 'Additional verification is required.');
  }
  return toTokens(result.AuthenticationResult);
}

/** Exchanges a refresh token for new access/ID tokens. Works for password and Google sessions alike. */
export async function refreshTokens(refreshToken: string): Promise<TokenSet> {
  const result = await call<{ AuthenticationResult: AuthenticationResult }>('InitiateAuth', {
    AuthFlow: 'REFRESH_TOKEN_AUTH',
    AuthParameters: { REFRESH_TOKEN: refreshToken },
  });
  return toTokens(result.AuthenticationResult);
}

export async function forgotPassword(username: string): Promise<CodeDelivery | undefined> {
  const result = await call<{ CodeDeliveryDetails?: RawCodeDelivery }>('ForgotPassword', { Username: username });
  return toDelivery(result.CodeDeliveryDetails);
}

export async function confirmForgotPassword(username: string, code: string, newPassword: string): Promise<void> {
  await call('ConfirmForgotPassword', { Username: username, ConfirmationCode: code, Password: newPassword });
}

/** Invalidates a refresh token and the tokens issued from it. */
export async function revokeToken(refreshToken: string): Promise<void> {
  await call('RevokeToken', { Token: refreshToken });
}
