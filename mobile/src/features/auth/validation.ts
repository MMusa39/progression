/** Client-side checks that mirror the user pool's rules, for instant feedback before any network call. */

export const passwordRules = [
  { label: 'At least 8 characters', test: (p: string) => p.length >= 8 },
  { label: 'An uppercase letter', test: (p: string) => /[A-Z]/.test(p) },
  { label: 'A lowercase letter', test: (p: string) => /[a-z]/.test(p) },
  { label: 'A number', test: (p: string) => /\d/.test(p) },
] as const;

export const isValidPassword = (password: string) => passwordRules.every((rule) => rule.test(password));

export const isValidEmail = (email: string) => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email.trim());

/**
 * Builds an E.164 phone number (e.g. "+15551234567") from a country code and
 * whatever the user typed, ignoring spaces, dashes, and parentheses. Returns
 * null if the result can't be a valid number.
 */
export function toE164(countryCode: string, localNumber: string): string | null {
  const cc = countryCode.replace(/\D/g, '');
  const digits = localNumber.replace(/\D/g, '');
  const e164 = `+${cc}${digits}`;
  return /^\+[1-9]\d{7,14}$/.test(e164) ? e164 : null;
}

export const normalizeEmail = (email: string) => email.trim().toLowerCase();
