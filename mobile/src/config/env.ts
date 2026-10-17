/**
 * Runtime configuration, resolved once at startup.
 *
 * Values come from `EXPO_PUBLIC_*` environment variables (see `.env.example`).
 * Expo inlines these at build time. They are visible in the app bundle, so
 * only non-secret values belong here (ids and URLs, never secrets).
 */
import Constants from 'expo-constants';

/**
 * Base URL of the Progression API.
 *
 * During development the phone loads the app from Metro on your Mac, so
 * `localhost` would mean the phone itself. Instead we reuse the host Metro is
 * served from (e.g. `192.168.1.20:8081`) and swap in the API port.
 */
function resolveApiUrl(): string {
  const explicit = process.env.EXPO_PUBLIC_API_URL;
  if (explicit) return explicit.replace(/\/$/, '');
  // A release build must be told where the API is; guessing from Metro only works in development.
  if (!__DEV__) return '';

  const metroHost = Constants.expoConfig?.hostUri?.split(':')[0];
  return `http://${metroHost ?? 'localhost'}:8080`;
}

const cognitoRegion = process.env.EXPO_PUBLIC_COGNITO_REGION;
const cognitoClientId = process.env.EXPO_PUBLIC_COGNITO_CLIENT_ID;
const cognitoDomain = process.env.EXPO_PUBLIC_COGNITO_DOMAIN?.replace(/\/$/, '');

const apiUrl = resolveApiUrl();

export const env = {
  apiUrl,

  /** Set when a release build is missing required configuration; the app shows it instead of failing obscurely. */
  configError: apiUrl ? null : 'This build has no API address (EXPO_PUBLIC_API_URL).',

  /** Amazon Cognito user pool settings: outputs of `cdk deploy Progression-Auth`. */
  cognito: {
    region: cognitoRegion ?? '',
    clientId: cognitoClientId ?? '',
    /** Hosted OAuth domain, e.g. https://progression-123.auth.us-east-1.amazoncognito.com */
    domain: cognitoDomain ?? '',
  },

  /** Email/phone sign-up and sign-in work once the user pool is configured. */
  cognitoEnabled: Boolean(cognitoRegion && cognitoClientId),

  /** Google sign-in additionally needs the hosted domain and a configured Google provider. */
  googleEnabled: Boolean(
    cognitoRegion && cognitoClientId && cognitoDomain && process.env.EXPO_PUBLIC_GOOGLE_SIGN_IN === 'true',
  ),

  /** Development builds offer a one-tap dev account backed by the API's /dev/token endpoint. */
  devAuthEnabled: __DEV__,
} as const;
