# Progression API (backend)

Spring Boot REST API for Progression. It stores workouts, exercises and sets in
PostgreSQL and serves them to the mobile app.

**Stack:** Java 25 · Spring Boot 4.1 · Spring Data JPA (Hibernate 7) · PostgreSQL 18 ·
Flyway · Spring Security (OAuth2 resource server) · springdoc-openapi · JUnit 5 ·
Testcontainers · Gradle (Kotlin DSL)

## Quick start

Prerequisites: JDK 25 and a running Docker daemon (`colima start`). See
[docs/development-setup.md](../docs/development-setup.md).

```bash
cd backend
./gradlew bootRun        # starts PostgreSQL via compose.yaml, migrates it, serves on :8080
```

Then:

```bash
# 1. Get a development access token (local profile only)
TOKEN=$(curl -s -X POST localhost:8080/dev/token \
  -H 'Content-Type: application/json' -d '{"subject":"dev-user"}' | jq -r .accessToken)

# 2. Call the API
curl -s localhost:8080/api/v1/me -H "Authorization: Bearer $TOKEN"
curl -s 'localhost:8080/api/v1/exercises?query=bench' -H "Authorization: Bearer $TOKEN"
```

Or open **http://localhost:8080/swagger-ui.html**, click **Authorize**, paste the
token, and try every endpoint from the browser.

## Commands

| Command | What it does |
| --- | --- |
| `./gradlew bootRun` | Run the API locally (`local` profile, auto-starts PostgreSQL) |
| `./gradlew test` | Run unit and integration tests (Testcontainers starts a throwaway PostgreSQL) |
| `./gradlew build` | Compile, test, and package `build/libs/progression-api-*.jar` |
| `docker compose down -v` | Stop the local database and delete its data |
| `python3 scripts/seed_dev_data.py` | Seed realistic workout history for the dev account (API must be running) |

## Code structure

Code is organized **by feature**, so everything about workouts lives together:

```
src/main/java/com/progression/
├── ProgressionApiApplication.java    entry point
├── common/
│   ├── WeightUnit.java               LB/KG + conversion (mirrors the DB's weight_kg column)
│   ├── error/                        exceptions + ApiExceptionHandler (RFC 9457 problem details)
│   ├── security/                     SecurityConfig (multi-issuer JWT), SecurityProperties, dev-only JWT signing + /dev/token
│   └── web/                          OpenAPI config, PageResponse
├── user/                             /me, just-in-time user provisioning, CurrentUser injection
├── exercise/                         exercise catalog + custom exercises
├── workout/                          workout aggregate, idempotent upsert, history, last performance
└── stats/                            progress analytics: summary, progression, records (JdbcClient + SQL)

src/main/resources/
├── application.yml                   shared config
├── application-local.yml             local dev (dev JWT secret, debug logging)
├── application-prod.yml              AWS (everything from environment variables)
└── db/migration/                     Flyway migrations (V1 schema, V2 exercise catalog, V3 stats view + e1RM function)

scripts/seed_dev_data.py               fills the local API with 16 weeks of realistic training data
```

Each feature has the same layers:

| Layer | Responsibility | Example |
| --- | --- | --- |
| Controller | HTTP only: routing, validation (`@Validated`), status codes | `WorkoutController` |
| Service | Business rules, transaction boundaries, entity → DTO mapping | `WorkoutService` |
| Repository | Data access (Spring Data JPA, JPQL) | `WorkoutRepository` |
| Entity | Persistent state + invariants, package-private mutators | `Workout`, `ExerciseSet` |
| DTO | API contract as immutable Java `record`s | `WorkoutRequest`, `WorkoutResponse` |

## Key concepts, and where to find them

| Concept | Where | Notes |
| --- | --- | --- |
| **Stateless JWT auth** | `common/security/SecurityConfig` | Every request is verified by signature; no server sessions. Tokens are routed **by issuer** (`JwtIssuerAuthenticationManagerResolver`): Cognito (JWKS, plus `token_use`/`client_id` checks) and, locally, HMAC dev tokens. |
| **Authorization by scoping** | `user/CurrentUser`, every repository query | The user id comes from the verified token, never from the request, and every query filters on it. Other users' data returns 404, not 403, so its existence isn't revealed. |
| **Just-in-time provisioning** | `user/UserService#provision` | `INSERT ... ON CONFLICT DO NOTHING` makes first-request user creation race-safe. |
| **Idempotent upsert** | `workout/WorkoutService#save` | `PUT` with client-generated UUIDs, so retries are safe. This is the foundation for offline sync (ADR 0003). |
| **Last-write-wins conflicts** | `WorkoutService#save` | Older `updatedAt` → `409 Conflict`. |
| **Optimistic locking** | `@Version` on the workout entities | Concurrent server-side writes → `409`, not a silent lost update. |
| **Aggregate root** | `workout/Workout` | Exercises and sets are only changed through their workout (cascade + orphan removal). |
| **Keyset pagination** | `WorkoutRepository#findPageAfter` | Seeks by (`startedAt`, `id`) instead of `OFFSET`: O(page) cost, and pages stay stable when new data is added. |
| **N+1 avoidance** | `hibernate.default_batch_fetch_size` | Lazy collections load in batches of up to 50. |
| **Schema migrations** | `db/migration/` | Flyway versions the schema. Hibernate only validates it (`ddl-auto: validate`). |
| **Consistent errors** | `common/error/ApiExceptionHandler` | Every error is `application/problem+json`, and validation errors list every bad field. |
| **Virtual threads** | `spring.threads.virtual.enabled` | Each request runs on a lightweight Java virtual thread. |
| **Analytics in SQL** | `stats/StatsRepository`, `V3__stats_view_and_e1rm.sql` | Reports use `JdbcClient` and plain SQL (grouping, `array_agg`, window functions) over a `working_set` view, not JPA. The e1RM formula is one SQL function, so every number agrees. |
| **Time-zone-aware bucketing** | `StatsRepository#buckets` | `date_trunc('week', started_at AT TIME ZONE :tz)`: weeks follow the user's calendar. Empty weeks are zero-filled in Java so charts don't compress time. |
| **Derived, never stored** | `stats/` | PRs, streaks and charts are computed from raw sets on request, so editing an old workout corrects everything. |
| **Testable time** | `common/TimeConfig` | Services take a `Clock` bean instead of calling `Instant.now()`. |

## Testing

```bash
./gradlew test
```

- **Integration tests** (`*ApiTest`, `SecurityIntegrationTest`) boot the whole
  application against a real PostgreSQL 18 container and drive it over HTTP
  with `MockMvcTester`. They cover the migrations, SQL, security rules and JSON
  contract together. Each test signs in as a fresh random user, so tests are
  isolated without truncating tables.
- **Unit tests** (`WorkoutCursorTest`, `WeightUnitTest`, `CognitoTokenValidatorTest`, `StatsServiceTest`) cover pure logic:
  the claim rules that reject Cognito ID tokens and tokens issued to other app clients, plus streak and
  bucket-filling date logic.
- **`StatsApiTest`** checks the analytics SQL against real PostgreSQL: Epley e1RM, warm-up exclusion,
  pound conversion, PRs only against *earlier* workouts, previous-period totals, and time-zone week boundaries.

Test reports: `build/reports/tests/test/index.html`.
