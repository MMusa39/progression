# Testing

What's tested automatically, what's been checked by hand, and what can only
be verified on a real iPhone with the cloud services deployed.

## Automated (run in CI on every push)

| Suite | Count | What it covers |
| --- | --- | --- |
| Backend (JUnit 5 + Testcontainers PostgreSQL) | 145 | Every API endpoint against a real database: auth, workouts, stats/PRs, friends and privacy rules, nutrition targets and trends, food/recipes/diary, routines, export/delete, rate limits; pure units like the target calculator, weight trend and adherence rules |
| Mobile (Jest) | 84 | Logic without a device: workout store (suggestions, routines, sticky notes), overload hints, plate math, nutrition trend shaping, dates, formatting, validation, JWT handling, rest timer; legal text in sync with docs/legal |
| Infrastructure (CDK assertions) | 11 | Security and cost settings of the synthesized CloudFormation: private encrypted database, internal load balancer, HTTPS-only CloudFront, no NAT gateway, secrets from Secrets Manager |
| CI extras | | ESLint and TypeScript for the app, a full `cdk synth`, and a build of the production Docker image |

## End-to-end smoke test (web preview)

`cd mobile && npm run e2e:web` (needs the API running with seed data, `npx expo
start --web`, and Chrome). It signs in with the development account and drives
26 real flows, failing on any page error, console error or failed API call:

weekly goal, start a routine, sticky note carried over, plate calculator, tick a
set from the overload suggestion, finish the workout, see it in history, search
and log a food, quick add, water, build a recipe, weigh in, edit and save the
plan, My Plan, trends, all three Progress views, an exercise's detail, friends, a
friend's profile, friends' shared recipes, "Save as routine", and the legal pages.

Last run: **26/26 passed**, twice in a row, with no errors.

## Checked by hand (web preview, light and dark mode)

Every screen, using the seed data: layout at iPhone width, empty states, chart
readouts and labels, and long text. The production container was started with
the `prod` profile: it reported healthy, rejected calls without a token, had no
dev or Swagger endpoints, and logged JSON.

## Not yet verified: needs a real iPhone and/or the deployed backend

These can't run in the web preview or CI. Do them on a phone (Expo Go against
your Mac, then a TestFlight build against AWS) before submitting:

**Sign-in (needs `Progression-Auth` deployed)**
- [ ] Sign up with email → code arrives → confirm → signed in
- [ ] Sign up with a phone number (needs SMS set up), sign in, forgot password
- [ ] Sign in with Google (if configured)
- [ ] Sign out, sign back in: history and food are still there

**Native features (Expo Go is enough)**
- [ ] Barcode scanning: allow the camera, scan a product (found → log it; unknown → "New food" with the barcode filled in)
- [ ] Rest timer notification with the app in the background
- [ ] Push notifications: friend request and a friend's PR (two phones or two accounts)
- [ ] Export my data → share sheet → save to Files, and the JSON opens
- [ ] Airplane mode mid-workout: keep logging, finish, turn the network back on → it syncs; the Offline pill appears and disappears
- [ ] Haptics on set completion, and the keyboard never covers inputs

**Release build (TestFlight)**
- [ ] App icon, splash screen and app name look right
- [ ] The build talks to the AWS API (not "App not configured")
- [ ] Delete account (with a throwaway account): signed out, can't sign back in with the same password, data gone

## Not covered

- Load and performance testing (expected scale: a few users; the API runs on 0.5 vCPU).
- Android: the app is built with cross-platform code, but has only been checked on iOS/web.
- Accessibility with VoiceOver: labels are on all controls and charts, but haven't been audited with a screen reader.
