/**
 * Holds the credentials between "Create account" and "Enter code" so the user
 * is signed in automatically after verifying, without retyping their password.
 *
 * Kept in memory only. It's never persisted or put in a route URL, and it's
 * cleared as soon as it's used.
 */
let pending: { username: string; password: string } | null = null;

export const pendingCredentials = {
  set(username: string, password: string) {
    pending = { username, password };
  },
  take(username: string): string | null {
    const password = pending?.username === username ? pending.password : null;
    pending = null;
    return password;
  },
};
