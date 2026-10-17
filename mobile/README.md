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
│       ├── (tabs)/              Native tab bar: (home) Workout · history · progress · profile
│       ├── (tabs)/progress/     Progress overview + per-exercise charts ([exerciseId].tsx)
│       ├── workout.tsx          Active workout logger (modal sheet)
│       ├── workout-complete.tsx Session summary + personal-record celebration
│       └── exercise-picker.tsx  Search/filter/multi-select, create custom exercises
├── components/charts/           SVG charts: LineChart, ColumnChart, HorizontalBars, Sparkline, DataTable
├── components/ui/               Design-system components (Button, TextField, Card, ...)
├── theme/                       Design tokens (color, spacing, type) + useTheme
├── config/env.ts                Runtime config from EXPO_PUBLIC_* variables
├── features/
│   ├── auth/                    Cognito client, Google OAuth (PKCE), secure session, dev sign-in
│   ├── api/                     HTTP client, API types, TanStack Query hooks
│   ├── workout/                 Active-workout store, upload queue, formatting, workout UI
│   └── progress/                Time-range store + filter, chart metrics, KPI tiles, PR display
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
- Each exercise fetches its **last performance**, which fills the PREVIOUS
  column and the grey suggestions. Tapping ✓ on an empty set logs the
  suggestion, so repeating last week's numbers takes one tap per set.

### Server state

TanStack Query owns everything fetched from the API: caching, background
refetch, pagination (`useInfiniteQuery` over the cursor-paginated history), and
invalidation after mutations. Query keys live in one place (`queryKeys`).

### Progress charts

- **One time range scopes everything** (`features/progress/range.ts`): presets
  4W / 3M / 6M / 1Y / All, or a custom "last N weeks/months". The selection is
  shared between the overview and every exercise screen and persisted.
- **Charts** (`components/charts/`) are small custom SVG components following
  the project's dataviz rules: one series per chart in a contrast-validated
  color, 2px lines with ringed markers, ≤24px columns with rounded tops, solid
  hairline gridlines, and a **fixed readout** that shows the latest value and
  follows your finger as you drag across the chart. Every chart has a
  **"Show data" table** so no value is only reachable by touch. See ADR 0006.
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
