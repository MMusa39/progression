# Architecture

This document describes how Progression is put together: the major components,
how data flows between them, and the cross-cutting concerns (auth, offline
support, observability) that shape the design.

## System overview

```
┌──────────────────────┐        HTTPS / JSON         ┌───────────────────────────┐
│  Mobile app (Expo)   │ ──────────────────────────▶ │  Application Load Balancer│
│                      │   Authorization: Bearer JWT └─────────────┬─────────────┘
│  • UI (React Native) │                                           │
│  • Local SQLite store│                                           ▼
│  • Sync queue        │                             ┌───────────────────────────┐
└──────────┬───────────┘                             │  Spring Boot API          │
           │ sign-in / refresh                       │  (ECS Fargate containers) │
           ▼                                         │                           │
┌──────────────────────┐   JWKS (public keys)        │  controller → service →   │
│  Amazon Cognito      │ ◀────────────────────────── │  repository               │
│  User Pool           │   used to verify tokens     └─────────────┬─────────────┘
└──────────────────────┘                                           │ JDBC
                                                                   ▼
                                                     ┌───────────────────────────┐
                                                     │  RDS PostgreSQL           │
                                                     │  (private subnet)         │
                                                     └───────────────────────────┘
```

For local development the AWS pieces are swapped for local equivalents:
PostgreSQL runs in Docker, and a `local` Spring profile accepts development
tokens in addition to Cognito tokens (see [Authentication](#authentication)).

## Components

### Mobile app (`mobile/`)

- **Expo + React Native + TypeScript.** One codebase for iOS and Android.
- **Expo Router** for file-based navigation (tabs: Workout, History, Progress,
  Profile).
- **TanStack Query** for server state: caching, background refetching, and
  request de-duplication.
- **Local persistence.** The in-progress workout lives in a zustand store
  persisted to AsyncStorage on every change, so a crash, a dead battery, or no
  signal never loses a set. Finished workouts go through a persisted upload
  queue.
- **Charts** are custom SVG components (`react-native-svg`) built to the
  project's dataviz rules: a single-series line chart per lift with touch
  scrubbing, sparklines in lists, a readable session list behind every chart,
  and colors validated for contrast in both themes (see
  [ADR 0006](adr/0006-custom-svg-charts.md)).
- **Progress answers three questions:** is each lift getting stronger (estimated
  1RM / heaviest weight over time), did I set records, am I consistent (workouts
  and weekly streak). Total volume ("tonnage") was deliberately left out (see
  [ADR 0007](adr/0007-focus-progress-on-strength.md)).
- **One time-range filter** (4W/3M/6M/1Y/All or custom "last N weeks/months")
  scopes every chart on the Progress screens.

### Backend API (`backend/`)

A Spring Boot application arranged in layers, organized by **feature package**
rather than by technical layer:

```
com.progression
├── exercise/      ExerciseController, ExerciseService, ExerciseRepository, Exercise
├── workout/       WorkoutController, WorkoutService, ...
├── stats/         analytics over the working_set view (JdbcClient + SQL)
├── user/          current-user resolution, preferences
├── social/        friends, invites, leaderboards, access checks
├── notification/  push tokens, domain-event listeners, Expo push sender
├── body/          weigh-ins and trend weight
├── nutrition/     goal profile and calorie/macro targets
├── food/          Open Food Facts client + cache, foods, recipes, diary
└── common/        error handling, security config, shared types
```

Each feature follows the same flow:

1. **Controller**: HTTP concerns only. It validates the request DTO, calls the
   service, and maps the result to a response DTO.
2. **Service**: business rules and transaction boundaries (`@Transactional`).
3. **Repository**: data access via Spring Data JPA. Analytics queries use
   native SQL where JPA would be awkward or slow.

DTOs (Java `record`s) are kept separate from JPA entities, so the API contract
can change independently of the schema and entities never leak to clients.

### Database

PostgreSQL. Workout data is naturally relational (a workout has exercises,
an exercise has sets), and the analytics features (best set per day, rolling
PRs) map cleanly onto SQL window functions. The schema is versioned with
**Flyway**; see [data-model.md](data-model.md).

### Infrastructure (`infra/`)

An AWS CDK application written in Java defines every cloud resource as code,
in three stacks:

```
phone ──HTTPS──▶ CloudFront ──(VPC origin)──▶ internal ALB ──▶ Fargate (ARM64) ──▶ RDS PostgreSQL (isolated subnets)
                                                                    └──▶ Cognito keys, Open Food Facts, Expo push
```

- `Progression-Auth`: Cognito user pool, Google provider, mobile app client.
- `Progression-Data`: VPC (no NAT gateway) and the database: encrypted,
  private, backed up, deletion-protected.
- `Progression-Api`: the container (built from `backend/Dockerfile`), an
  internal load balancer, and CloudFront for HTTPS.

Nothing is created by hand in the AWS console, so the environment can be rebuilt or
torn down with one command. See [ADR 0004](adr/0004-local-first-aws-later.md)
and [ADR 0012](adr/0012-deployment-architecture.md).

## Cross-cutting concerns

### Authentication

- Users sign up and sign in against an **Amazon Cognito User Pool** with an
  **email address, a phone number, or a Google account** (see
  [ADR 0005](adr/0005-cognito-authentication.md)):
  - *Email/phone:* custom in-app screens call Cognito's API directly
    (`SignUp` → verification code → `InitiateAuth`).
  - *Google:* OAuth 2.0 authorization code + PKCE through Cognito's hosted
    endpoints, which federate to Google.
- Whatever the method, the app ends up with the same Cognito tokens: a
  short-lived **access token (JWT)**, an ID token (profile claims), and a
  refresh token, all stored in the iOS Keychain / Android Keystore.
- Every API request carries `Authorization: Bearer <access token>`.
- The API is a **stateless OAuth2 resource server**. Spring Security downloads
  Cognito's public keys (JWKS) and verifies each token's signature, expiry and
  issuer, plus `token_use=access` and `client_id` (Cognito access tokens
  carry `client_id` instead of `aud`). No sessions are stored on the server.
- Tokens are routed to a verifier **by issuer**, so in local development the
  API accepts both Cognito tokens and HMAC-signed development tokens from
  `POST /dev/token`.
- The token's `sub` claim identifies the user. On first request the API creates
  a matching row in `app_user` (just-in-time provisioning).
- **Authorization:** every query is scoped to the current user's id. A user can
  never read or modify another user's workouts, and the service layer enforces
  this rather than trusting ids sent by the client.

### Offline-first sync

Gyms are often basements with no signal, so logging must never depend on the
network.

- **Client-generated IDs.** The app creates UUIDs for workouts, exercises in a
  workout, and sets. The server accepts them as primary keys.
- **Idempotent upserts.** A workout is saved with `PUT /api/v1/workouts/{id}`,
  which sends the whole workout. Retrying the same request any number of times
  produces the same result, so the sync queue can safely retry after a
  timeout.
- **Last-write-wins with versions.** Each workout carries an `updatedAt`
  timestamp. The server rejects a write older than what it already holds
  (`409 Conflict`), and the client then refetches.
- **Network awareness.** TanStack Query's `onlineManager` follows the phone's
  connection (`expo-network`): offline, queries and mutations pause instead of
  failing, and resume on reconnect. A small banner says the app is offline.

### Friends and privacy

- Friendships are mutual (request → accept, or an invite link that connects
  immediately). See [ADR 0008](adr/0008-friends-and-privacy.md).
- **Access is checked in one place** (`FriendService.requireFriends` /
  `requireWorkoutAccess`) before any friend data is read. Non-friends get
  404, so a stranger can't learn whether an account has data. Friends who
  share PRs only get 403 on workouts.
- Friend views reuse the existing workout and stats services through
  owner-id variants (`listForOwner`, `recentRecordsOf`), so there's no
  duplicated query logic. Leaderboards compute everyone in one SQL query.

### Food and body weight

- **Food data** comes from Open Food Facts through `FoodDatabase`
  (`OpenFoodFactsClient`), and every product looked up is cached in the `food`
  table, so repeat scans never leave our database. See
  [ADR 0010](adr/0010-food-tracking-and-targets.md).
- **Diary entries snapshot their nutrition** when logged; history never
  changes when a food or recipe does.
- **Trends** (`NutritionTrends`) judge each logged day against the targets
  with server-side rules that are sent along with the data, so the app's chart
  bands and the counts always agree ([ADR 0011](adr/0011-nutrition-adherence.md)).
- **Targets are computed on request** (`TargetCalculator`) from the profile,
  the weigh-in trend and the last 28 days of diary, the same "derived, never
  stored" rule as PRs.
- **Privacy:** weight, diary and goals are never visible to friends. Recipes
  are shared only when the owner switches on "Share with friends", checked
  through the same `FriendService` access rule; friends save a copy rather
  than reading the original.

### Notifications

```
FriendService / WorkoutService ──publish──▶ domain event (RequestSent, RequestAccepted, WorkoutSaved)
                                                │  after the transaction commits, on a virtual thread
                                                ▼
                                   NotificationService ──▶ preferences + device tokens
                                                │
                                                ▼
                                   ExpoPushSender ──HTTPS──▶ Expo push service ──▶ APNs / FCM
```

- Features **publish events** and don't call notifications directly, so the
  social and workout modules don't depend on the notification module.
- `@TransactionalEventListener` + `@Async`: nobody is notified about something
  that rolled back, and requests never wait on Expo. Send failures are logged
  and never fail the request.
- The **rest-over alert** is a local notification scheduled on the phone (no
  server involved), kept in sync with the rest timer.
  See [ADR 0009](adr/0009-push-notifications.md).

### Error handling

All errors are returned as [RFC 9457 Problem Details](https://www.rfc-editor.org/rfc/rfc9457)
(`application/problem+json`) from a single `@RestControllerAdvice`, so the
mobile app handles one consistent error shape. In the app, a root
`ErrorBoundary` replaces a crashed screen with "Something went wrong" and a
retry button.

### Rate limiting

A token-bucket filter after authentication limits each user (or IP, before
sign-in) to 300 requests a minute, and 30 a minute for endpoints that call Open
Food Facts or build a full export. It answers `429` with `Retry-After`. The
buckets are per instance; a global limit would use AWS WAF on CloudFront.

### Observability

- Structured JSON logs (Elastic Common Schema, `prod` profile) shipped to
  CloudWatch by the ECS log driver, queryable by field in Logs Insights.
- Spring Boot Actuator `/actuator/health/readiness` used by the load balancer's
  health checks (details hidden).
- Graceful shutdown: in-flight requests finish (up to 20s) before a task stops,
  matching the target group's deregistration delay, so deploys don't drop requests.

### Testing strategy

| Level | Tooling | What it covers |
| --- | --- | --- |
| Unit | JUnit 5, Mockito, AssertJ | Service logic such as e1RM calculation, PR detection, and overload hints |
| Integration | Spring Boot Test, **Testcontainers** (real PostgreSQL) | Repositories, migrations, and full HTTP request → database round trips |
| Mobile unit | Jest, React Native Testing Library | Hooks, formatting, and component behaviour |
| CI | GitHub Actions | Runs all of the above on every push and pull request |
