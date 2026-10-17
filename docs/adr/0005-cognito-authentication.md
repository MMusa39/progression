# 0005: Amazon Cognito with custom screens for email, phone, and Google sign-in

- **Status:** Accepted
- **Date:** 2026-10-16

## Context
Users must be able to register with an **email address**, a **phone number**,
or a **Google account**. The backend should never store passwords, and the
mobile app must run in Expo Go during development (no custom native modules).

## Options considered
1. **Build auth in Spring Boot** (password hashing, email/SMS, OAuth with Google).
   This is a lot of security-critical code to own, and it's easy to get wrong.
2. **Cognito Hosted UI / Managed Login for everything.** The least code, but sign-up
   happens on a web page that doesn't match the app's design.
3. **AWS Amplify Auth library.** A full-featured client, but it requires native
   modules (not available in Expo Go) and adds significant bundle weight.
4. **Cognito, with custom native screens calling the Cognito API directly for
   email/phone, and the OAuth code + PKCE flow for Google.**

## Decision
Option 4.

- **User pool:** email and phone are both *username attributes* (sign in with
  either), auto-verified with one-time codes. Password policy: 8+ characters
  with upper, lower, and digit.
- **Email/phone:** the app calls `SignUp`, `ConfirmSignUp`, `InitiateAuth`
  (`USER_PASSWORD_AUTH`), and `ForgotPassword` over HTTPS. The app client is
  public (no secret), so no request signing is required.
- **Google:** Cognito federates with Google. The app opens
  `/oauth2/authorize?identity_provider=Google` via `expo-auth-session` with
  PKCE, then exchanges the code for Cognito tokens.
- **API:** verifies Cognito access tokens (signature via JWKS, issuer, expiry,
  `token_use=access`, `client_id`). It routes tokens by issuer, so local
  development tokens keep working alongside Cognito.
- **Tokens on device:** iOS Keychain / Android Keystore via `expo-secure-store`;
  access tokens refreshed automatically; refresh token revoked on sign-out.

## Consequences
- No password ever reaches our backend or database.
- One token issuer for all three sign-in methods, so the API's security
  configuration stays simple.
- `USER_PASSWORD_AUTH` sends the password to Cognito over TLS. SRP would avoid
  sending it at all, but needs a big-number crypto implementation on the client.
  This is a reasonable trade-off for now and can be revisited.
- Signing up with email and later with Google (same address) creates two Cognito
  users. Linking them needs a pre-sign-up Lambda trigger (future work).
- SMS requires AWS account-level setup (sandbox exit, origination number). See
  `infra/README.md`.
