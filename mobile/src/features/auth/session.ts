/**
 * Owns the signed-in session: storing tokens securely, handing out a valid
 * access token, refreshing it before it expires, and signing out.
 *
 * This is plain TypeScript, not React, so the API client can use it outside
 * components. React reads it through `AuthProvider` (useSyncExternalStore).
 *
 * Storage: tokens live in the iOS Keychain / Android Keystore via
 * expo-secure-store, never in AsyncStorage. Each token goes under its own key
 * to stay within SecureStore's per-value size limit.
 */
import * as SecureStore from 'expo-secure-store';

import { decodeJwt } from '@/lib/jwt';

import * as cognito from './cognito';

/** How the user signed in. Determines how the session is refreshed and what the profile shows. */
export type AuthProvider = 'password' | 'google' | 'dev';

export type TokenSet = {
  accessToken: string;
  idToken?: string;
  /** Long-lived; absent for dev tokens. */
  refreshToken?: string;
  /** Lifetime of the access token, in seconds. */
  expiresIn: number;
};

/** Public profile derived from token claims. */
export type SessionUser = {
  id: string;
  email?: string;
  phoneNumber?: string;
  name?: string;
  provider: AuthProvider;
};

export type SessionState =
  | { status: 'loading' }
  | { status: 'signedOut'; reason?: 'expired' }
  | { status: 'signedIn'; user: SessionUser };

type StoredSession = {
  provider: AuthProvider;
  accessToken: string;
  idToken?: string;
  refreshToken?: string;
  /** Epoch milliseconds. */
  expiresAt: number;
};

const KEYS = {
  meta: 'progression.session.meta',
  access: 'progression.session.access',
  id: 'progression.session.id',
  refresh: 'progression.session.refresh',
} as const;

/** Refresh this long before actual expiry, so a request never races the deadline. */
const EXPIRY_SKEW_MS = 60_000;

let session: StoredSession | null = null;
let state: SessionState = { status: 'loading' };
let refreshInFlight: Promise<string> | null = null;
const listeners = new Set<() => void>();

function setState(next: SessionState) {
  state = next;
  listeners.forEach((listener) => listener());
}

function userFrom(stored: StoredSession): SessionUser {
  // ID tokens carry profile claims; dev sessions only have an access token.
  const claims = decodeJwt(stored.idToken ?? stored.accessToken);
  const name =
    (claims.name as string | undefined) ??
    ([claims.given_name, claims.family_name].filter(Boolean).join(' ') || undefined);
  return {
    id: String(claims.sub),
    email: claims.email as string | undefined,
    phoneNumber: claims.phone_number as string | undefined,
    name,
    provider: stored.provider,
  };
}

async function persist(stored: StoredSession | null) {
  if (!stored) {
    await Promise.all(Object.values(KEYS).map((key) => SecureStore.deleteItemAsync(key)));
    return;
  }
  await SecureStore.setItemAsync(KEYS.meta, JSON.stringify({ provider: stored.provider, expiresAt: stored.expiresAt }));
  await SecureStore.setItemAsync(KEYS.access, stored.accessToken);
  await (stored.idToken ? SecureStore.setItemAsync(KEYS.id, stored.idToken) : SecureStore.deleteItemAsync(KEYS.id));
  await (stored.refreshToken
    ? SecureStore.setItemAsync(KEYS.refresh, stored.refreshToken)
    : SecureStore.deleteItemAsync(KEYS.refresh));
}

async function refresh(): Promise<string> {
  const current = session;
  if (!current?.refreshToken) {
    // Dev tokens (and any session without a refresh token) can't be renewed.
    await signOut('expired');
    throw new Error('Session expired');
  }
  try {
    const tokens = await cognito.refreshTokens(current.refreshToken);
    session = {
      ...current,
      accessToken: tokens.accessToken,
      idToken: tokens.idToken ?? current.idToken,
      // Cognito doesn't rotate refresh tokens by default; keep the old one if none is returned.
      refreshToken: tokens.refreshToken ?? current.refreshToken,
      expiresAt: Date.now() + tokens.expiresIn * 1000,
    };
    await persist(session);
    return session.accessToken;
  } catch (error) {
    if (error instanceof cognito.CognitoError && error.code === 'NotAuthorizedException') {
      // Refresh token revoked or expired: the user must sign in again.
      await signOut('expired');
    }
    throw error;
  }
}

async function signOut(reason?: 'expired') {
  const refreshToken = session?.refreshToken;
  session = null;
  await persist(null);
  setState({ status: 'signedOut', reason });
  if (refreshToken) {
    // Best effort: invalidate the refresh token server-side so a copy can't be reused.
    cognito.revokeToken(refreshToken).catch(() => {});
  }
}

export const authSession = {
  getState: (): SessionState => state,

  subscribe(listener: () => void): () => void {
    listeners.add(listener);
    return () => listeners.delete(listener);
  },

  /** Restores the session from secure storage at app start. */
  async load(): Promise<void> {
    try {
      const [meta, accessToken, idToken, refreshToken] = await Promise.all([
        SecureStore.getItemAsync(KEYS.meta),
        SecureStore.getItemAsync(KEYS.access),
        SecureStore.getItemAsync(KEYS.id),
        SecureStore.getItemAsync(KEYS.refresh),
      ]);
      if (meta && accessToken) {
        const { provider, expiresAt } = JSON.parse(meta) as Pick<StoredSession, 'provider' | 'expiresAt'>;
        session = { provider, expiresAt, accessToken, idToken: idToken ?? undefined, refreshToken: refreshToken ?? undefined };
        setState({ status: 'signedIn', user: userFrom(session) });
        return;
      }
    } catch {
      // Corrupt or unreadable storage: fall through to signed out.
    }
    session = null;
    setState({ status: 'signedOut' });
  },

  /** Stores tokens from any sign-in method and marks the user as signed in. */
  async signIn(tokens: TokenSet, provider: AuthProvider): Promise<void> {
    session = {
      provider,
      accessToken: tokens.accessToken,
      idToken: tokens.idToken,
      refreshToken: tokens.refreshToken,
      expiresAt: Date.now() + tokens.expiresIn * 1000,
    };
    await persist(session);
    setState({ status: 'signedIn', user: userFrom(session) });
  },

  /**
   * A currently valid access token, refreshing it first if it's about to
   * expire. Concurrent callers share a single refresh request.
   */
  async getAccessToken({ forceRefresh = false } = {}): Promise<string> {
    if (!session) throw new Error('Not signed in');
    if (!forceRefresh && session.expiresAt - EXPIRY_SKEW_MS > Date.now()) {
      return session.accessToken;
    }
    refreshInFlight ??= refresh().finally(() => {
      refreshInFlight = null;
    });
    return refreshInFlight;
  },

  signOut: () => signOut(),

  /** Clears the session after the API rejected a freshly refreshed token. */
  expire: () => signOut('expired'),
};
