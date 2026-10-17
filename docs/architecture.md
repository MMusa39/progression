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
- **Charts** for progression graphs, rendered natively for smooth scrolling.

### Backend API (`backend/`)

A Spring Boot application arranged in layers, organized by **feature package**
rather than by technical layer:

```
com.progression
├── exercise/      ExerciseController, ExerciseService, ExerciseRepository, Exercise
├── workout/       WorkoutController, WorkoutService, ...
├── stats/         progression & personal-record queries
├── user/          current-user resolution, preferences
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

An AWS CDK application written in Java defines every cloud resource as code:
VPC, RDS instance, ECS Fargate service behind an Application Load Balancer,
Cognito User Pool, Secrets Manager entries, and CloudWatch log groups. Nothing
is created by hand in the AWS console, so the environment can be rebuilt or
torn down with one command. See [ADR 0004](adr/0004-local-first-aws-later.md).

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

### Error handling

All errors are returned as [RFC 9457 Problem Details](https://www.rfc-editor.org/rfc/rfc9457)
(`application/problem+json`) from a single `@RestControllerAdvice`, so the
mobile app handles one consistent error shape.

### Observability

- Structured JSON logs (with a per-request correlation id) shipped to CloudWatch.
- Spring Boot Actuator `/actuator/health` used by the load balancer's health
  checks.
- Micrometer metrics for request latency and error rate.

### Testing strategy

| Level | Tooling | What it covers |
| --- | --- | --- |
| Unit | JUnit 5, Mockito, AssertJ | Service logic such as e1RM calculation, PR detection, and overload hints |
| Integration | Spring Boot Test, **Testcontainers** (real PostgreSQL) | Repositories, migrations, and full HTTP request → database round trips |
| Mobile unit | Jest, React Native Testing Library | Hooks, formatting, and component behaviour |
| CI | GitHub Actions | Runs all of the above on every push and pull request |
