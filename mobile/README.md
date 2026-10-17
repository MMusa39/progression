# Progression mobile app

React Native app (Expo SDK 57, TypeScript) for logging workouts and seeing how
your lifts progress.

## Run it on your iPhone

1. Install **Expo Go** from the App Store. The project targets the Expo SDK that
   the App Store's Expo Go supports (currently **SDK 57**). If Expo Go says the
   project needs a newer version, the SDKs are out of sync, so check
   `"expo"` in `package.json` against the SDK your Expo Go lists.
2. Start the API (`cd ../backend && ./gradlew bootRun`). The app talks to it
   over your Wi-Fi.
3. Start the app:
   ```bash
   cd mobile
   npm install        # first time only
   npx expo start
   ```
4. Scan the QR code with the iPhone Camera app. Your phone and Mac must be on
   the same Wi-Fi network.
5. On the welcome screen, tap **Use development account** to sign in without
   Cognito, or set up real accounts (below).

The app finds the API automatically: it reuses the IP address your phone loads
the app from and swaps in port 8080. If that doesn't work (e.g. on a VPN), set
`EXPO_PUBLIC_API_URL` in `.env`.

### Real accounts (email, phone, Google)

Deploy the Cognito stack (see [infra/README.md](../infra/README.md)), then:

```bash
cp .env.example .env    # fill in the values from the deploy outputs
npx expo start --clear  # env changes need a cache clear
```

## Commands

| Command | Purpose |
| --- | --- |
| `npx expo start` | Dev server (press `i` for the iOS simulator if Xcode is installed) |
| `npm test` | Unit tests (Jest + jest-expo) |
| `npm run typecheck` | TypeScript, including typed routes |
| `npm run lint` | ESLint (eslint-config-expo) |
| `npx expo-doctor` | Checks dependency versions and config |

## Project structure

```
src/
├── app/                         Screens. Expo Router maps files to routes.
│   ├── _layout.tsx              Providers + auth guard (Stack.Protected)
│   ├── (auth)/                  Signed-out flow: welcome, sign-up, confirm, sign-in, forgot-password
│   └── (app)/                   Signed-in area
│       ├── _layout.tsx          Stack: tabs + modals, background sync
│       ├── (tabs)/              Native tab bar (never minimizes): Workout · Food · Progress · Friends · Profile
│       ├── (tabs)/(home)/       Workout home + history (/history, /history/[id])
│       ├── (tabs)/food/         Diary, add/search, scan, item, quick add, custom food, goals, recipes, shared recipes
│       ├── (tabs)/progress/     Strength | Body weight overview + per-exercise charts ([exerciseId].tsx)
│       ├── weigh-in.tsx         Log or edit a weigh-in (modal)
│       ├── workout.tsx          Active workout logger (modal sheet)
│       ├── workout-complete.tsx Session summary + personal-record celebration
│       └── exercise-picker.tsx  Search/filter/multi-select, create custom exercises
├── components/charts/           SVG charts: LineChart (with touch scrubbing), Sparkline
├── components/ui/               Design-system components (Button, TextField, Card, ...)
├── theme/                       Design tokens (color, spacing, type) + useTheme
├── config/env.ts                Runtime config from EXPO_PUBLIC_* variables
├── features/
│   ├── auth/                    Cognito client, Google OAuth (PKCE), secure session, dev sign-in
│   ├── api/                     HTTP client, API types, TanStack Query hooks
│   ├── workout/                 Active-workout store, upload queue, formatting, workout UI
│   ├── progress/                Time-range store + filter, chart metrics, KPI tiles, PR display
│   ├── body/                    Weigh-in queries, body-weight overview (trend chart, goal card)
│   ├── nutrition/               Goal profile + targets queries
│   └── food/                    Diary/food/recipe queries, recipe draft store, day summary, meal helpers
└── lib/                         Small framework-free helpers (JWT decode, query client)
```

## How it works

### Authentication

| Method | Implementation |
| --- | --- |
| Email or phone + password | `features/auth/cognito.ts` calls Cognito's API directly (`SignUp` → `ConfirmSignUp` → `InitiateAuth`). Custom screens, no hosted web page, and no AWS SDK. |
| Google | `features/auth/google.ts`: OAuth 2.0 authorization code + **PKCE** through Cognito's hosted endpoints with `identity_provider=Google`. |
| Development | `features/auth/devAuth.ts`: token from the local API's `/dev/token`. Only in dev builds. |

All three end in the same place: `authSession.signIn(tokens)`. Tokens are
stored in the iOS Keychain (`expo-secure-store`), and the access token is
refreshed automatically before it expires (`authSession.getAccessToken`). The
root layout's `Stack.Protected` guards switch between the signed-out and
signed-in halves of the app whenever the session changes.

### Logging a workout

- The in-progress workout lives in a **zustand store persisted to
  AsyncStorage** (`activeWorkoutStore.ts`). Every keystroke is saved on the
  device, so closing the app or losing signal never loses a set.
- IDs are generated on the phone. When you tap **Finish**, the workout goes into
  an **upload queue** (`workoutSync.ts`) and is sent with
  `PUT /api/v1/workouts/{id}`. That call is idempotent, so failed uploads can be
  retried safely (on next launch / app foreground).
- **Editing a past workout** loads it into the same store with an `editing`
  flag: ids and set times are kept, and Save sends the same idempotent PUT, so
  the server updates it in place (its original end time is preserved).
- Ticking off a set starts the **rest timer** (`restTimer.ts`). It stores an
  absolute deadline rather than a countdown, so it stays correct if the app
  is backgrounded or reloaded.
- Each exercise fetches its **last performance**, which fills the PREVIOUS
  column and the grey suggestions. Tapping ✓ on an empty set logs the
  suggestion, so repeating last week's numbers takes one tap per set.

### Server state

TanStack Query owns everything fetched from the API: caching, background
refetch, pagination (`useInfiniteQuery` over the cursor-paginated history), and
invalidation after mutations. Query keys live in one place (`queryKeys`).

### Friends

- A **Friends** tab asks for a @username first, then shows incoming requests,
  the two leaderboards, and your friends. Adding friends happens by username
  search, a shared invite link (`Linking.createURL('invite/CODE')`, so it
  works in Expo Go and in builds), or by typing an invite code.
- All friend actions go through one mutation (`useFriendAction`) that refreshes
  everything under the `['social']` query key, because one action can change
  several screens.
- A friend's workout uses the same `WorkoutDetail` component as your own
  history, read-only.

### Notifications

- **Rest-over alert:** a local notification scheduled when rest starts and
  rescheduled or cancelled whenever the timer changes (`restNotifications.ts`
  subscribes to the timer store). It's silent while the app is open, since the
  in-app bar already buzzes. Works in Expo Go.
- **Push** (friend requests, friends' PRs): the app registers its Expo push
  token with the API on launch (only if permission was already given) and
  removes it on sign-out. Tapping a notification opens the screen in its
  `data.path`.
- **Permission is asked in context, never on launch:** a one-line opt-in on
  the rest timer bar, a card on the Friends tab, and a Notifications section in Profile.

#### Turning on real push for your phone

Rest alerts need nothing extra. Friend pushes need an Expo project, and on
iPhone usually a development build:

1. Create a free account at [expo.dev](https://expo.dev), then in `mobile/`:
   ```bash
   npx eas-cli@latest login
   npx eas-cli@latest init      # adds extra.eas.projectId to app.json
   ```
2. Restart `npx expo start`, open **Profile → Turn on notifications**. If a
   token registers in Expo Go, you're done.
3. Otherwise build a development build (needs the paid Apple Developer
   Program for push credentials):
   ```bash
   npx eas-cli@latest build --profile development --platform ios
   npx expo start --dev-client
   ```

### Food and body weight

- **Food tab:** a day at a time (swipe days with the arrows; tap the date for
  today). The summary shows calories eaten vs. target and protein/carbs/fat
  bars; tap it to edit your goal. Each meal lists its entries (tap to edit,
  long-press to delete), with **Add food** and **Copy previous day**.
- **Add food** searches your foods and cached Open Food Facts products, and
  offers **Scan**, **Quick add** and **New food**, plus Recent / My foods /
  Recipes tabs. Picking something opens the amount screen (servings or grams)
  with live nutrition.
- **Barcode scanning** (`food/scan.tsx`) uses `expo-camera`'s `CameraView`,
  which works in Expo Go on a phone after you allow camera access. A found
  product opens the amount screen; an unknown one opens **New food** with the
  barcode filled in, so the next scan finds it. (The web preview can't scan.)
- **Recipes** are edited in a small zustand draft (`features/food/recipeDraft.ts`)
  so "Add ingredient" can reuse the normal search/scan screens and drop the
  pick back into the recipe. **Share with friends** makes a recipe visible
  under Recipes → From friends, where friends can **Save to my recipes**.
- **Progress → Body weight** shows the trend weight (big number), the change
  over the range, the weekly rate, your goal and projected date, and a chart of
  the trend line over faint daily weigh-ins.
- Dates for diary days and weigh-ins are **local calendar dates**
  (`lib/dates.ts`), never UTC instants, so late-night logging lands on the
  right day.

### Progress charts

- **One time range scopes everything** (`features/progress/range.ts`): presets
  4W / 3M / 6M / 1Y / All, or a custom "last N weeks/months". The selection is
  shared between the overview and every exercise screen and persisted.
- **The Progress tab answers three questions:** am I training consistently
  (workouts + weekly streak), did I set records (recent PRs), and is each lift
  getting stronger (strength change over the range, with a sparkline).
- **Charts** (`components/charts/`) are small custom SVG components following
  the project's dataviz rules: one series in a contrast-validated color, 2px
  lines with ringed markers, solid hairline gridlines, and a readout that
  follows your finger as you drag across the chart. Each lift's chart sits
  above a list of its sessions, so no value is only reachable by touch. See ADR 0006.
- While a new range loads, the previous charts stay on screen, dimmed
  (`keepPreviousData`), so there's no flash or layout jump.
- **Personal records** come from the server after a workout uploads. The
  "Workout complete" screen celebrates them, and History marks the record sets.

To preview with data: run the API, then `python3 ../backend/scripts/seed_dev_data.py`,
then sign in with the development account. `npx expo start --web` runs the app in
a desktop browser for quick visual checks.

### Design system

`theme/tokens.ts` defines the palette (dark-first, one lime accent), spacing,
radii, and type scale. Components only use tokens, and light mode is supported
through the same names. Gym-specific choices: 56pt primary buttons, haptic
feedback on every action, tabular rounded digits for weights and timers, and
numeric keypads with a Done bar.
