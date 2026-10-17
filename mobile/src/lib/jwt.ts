/**
 * Minimal JWT payload decoding, for reading claims (expiry, email) on the
 * client. This does NOT verify the signature. The client never needs to,
 * because the API verifies every token it receives.
 */
export type JwtClaims = Record<string, unknown> & { sub?: string; exp?: number; iss?: string };

export function decodeJwt(token: string): JwtClaims {
  const payload = token.split('.')[1];
  if (!payload) throw new Error('Malformed JWT');
  const base64 = payload.replace(/-/g, '+').replace(/_/g, '/').padEnd(Math.ceil(payload.length / 4) * 4, '=');
  // atob yields a binary string; percent-encode each byte so multi-byte UTF-8 characters decode correctly.
  const json = decodeURIComponent(
    Array.from(atob(base64), (c) => '%' + c.charCodeAt(0).toString(16).padStart(2, '0')).join(''),
  );
  return JSON.parse(json) as JwtClaims;
}
