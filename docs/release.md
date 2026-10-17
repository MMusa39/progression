# Release checklist

What's done in the code, and the steps that need your accounts and decisions
to ship Progression on the App Store. Work top to bottom; each step says roughly
how long it takes and what it costs.

## Done in the code

- [x] App icon, splash screen, bundle id `com.mmusa39.progression`, version 1.0.0 (build numbers auto-increment on EAS)
- [x] Privacy manifest (required-reason APIs), no non-exempt encryption, camera-only permission with a clear reason
- [x] In-app **account deletion** (App Store guideline 5.1.1(v)) and **data export**
- [x] Privacy policy and terms in the app (Profile), with Markdown copies in `docs/legal/` for hosting
- [x] Release builds refuse to run without a configured API address; crash screen; offline banner
- [x] Production API: container image, rate limits, JSON logs, graceful shutdown; no dev-token or Swagger endpoints in `prod`
- [x] Infrastructure as code: `Progression-Auth`, `Progression-Data`, `Progression-Api` (see `infra/README.md`)
- [x] CI: backend tests + image build, infrastructure tests + synth, mobile lint/typecheck/tests

## 1. Deploy the backend (AWS, ~1 hour, ~$35/month)

1. `aws configure` with your AWS account, then `cd infra && cdk bootstrap` (once).
2. `cdk deploy Progression-Auth`. Note the outputs: user pool id, app client id, hosted domain.
3. `cdk deploy Progression-Data`, then `cdk deploy Progression-Api`. Note the **ApiUrl** output.
4. Check it: `curl <ApiUrl>/actuator/health` should return `{"status":"UP"}`.
5. Optional: Google sign-in (infra README, step 3) and SMS for phone sign-up (step 4).

## 2. Configure production builds (Expo, ~20 minutes, free)

1. Create an Expo account, then in `mobile/`: `npx eas-cli@latest login` and `npx eas-cli@latest init`
   (adds the project id to `app.json`).
2. Set the production environment variables (values from step 1):

   ```bash
   npx eas-cli@latest env:create --environment production --name EXPO_PUBLIC_API_URL --value https://<ApiUrl>
   npx eas-cli@latest env:create --environment production --name EXPO_PUBLIC_COGNITO_REGION --value us-east-1
   npx eas-cli@latest env:create --environment production --name EXPO_PUBLIC_COGNITO_CLIENT_ID --value <client id>
   npx eas-cli@latest env:create --environment production --name EXPO_PUBLIC_COGNITO_DOMAIN --value https://<hosted domain>
   npx eas-cli@latest env:create --environment production --name EXPO_PUBLIC_GOOGLE_SIGN_IN --value true   # only if Google is set up
   ```

3. Add the production redirect `progression://auth` to the Cognito app client if
   it isn't there (the auth stack includes it by default).

## 3. Apple (~1–2 days including review, $99/year)

1. Join the [Apple Developer Program](https://developer.apple.com/programs/).
2. In App Store Connect, create the app with bundle id `com.mmusa39.progression`.
   (To use a different id, change `ios.bundleIdentifier` in `mobile/app.json` first. It can't change after release.)
3. Build and upload: `npx eas-cli@latest build -p ios --profile production`, then
   `npx eas-cli@latest submit -p ios --latest`. EAS creates the signing certificates for you.
4. Test it on your phone through **TestFlight** before submitting for review.

## 4. Decisions only you can make

- **Support contact.** The App Store needs a support URL and the privacy policy
  points people to it. A simple option is a GitHub Pages site or a form.
  (Your personal email isn't in the app or policy on purpose.)
- **Public privacy policy URL.** Host `docs/legal/privacy-policy.md` and
  `terms.md` somewhere public (the repo is private). GitHub Pages from a small
  public repo or a GitHub Gist both work.
- **Bundle id** (see 3.2) and the **app name** on the store (must be unique; "Progression" may be taken, e.g. "Progression: Lift & Eat").

## 5. App Store listing

- **Category:** Health & Fitness. **Age rating:** 12+ is typical for user-generated content (usernames, shared recipes).
- **Screenshots:** 6.9" iPhone (1320 × 2868), at least 3. Good candidates: the logger with
  an overload hint, Progress → Strength, the Food diary, Nutrition trends, Friends.
- **App Review notes:** give the reviewer a demo account (email + password) with some data in it. Sign-in is required to use the app, and reviewers can't create one easily without receiving a verification code.
- **App Privacy questionnaire** (what to declare):

  | Data type | Collected | Linked to the user | Used for tracking |
  | --- | --- | --- | --- |
  | Contact info: email address, phone number | Yes (sign-in) | Yes | No |
  | Health & fitness (workouts, body weight, nutrition) | Yes | Yes | No |
  | User content (recipes, custom foods, notes) | Yes | Yes | No |
  | Identifiers: user id | Yes | Yes | No |
  | Usage data, diagnostics, location, contacts, purchases | No | | |

  Purpose for all collected data: **App functionality**. No third-party advertising or analytics.

## After launch

- Watch the API logs in CloudWatch (see `infra/README.md`) and the
  `ExitOnOutOfMemoryError` restarts in ECS, if any.
- Bump `version` in `mobile/app.json` for each App Store release; build numbers increment automatically.
- Consider: crash reporting (e.g. Sentry), over-the-air updates (`expo-updates` + EAS Update),
  and a WAF rate rule on CloudFront once there's real traffic.
