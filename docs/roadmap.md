# Roadmap

Work is delivered in phases. Each phase ends with something runnable and is
merged with tests and documentation.

## Phase 0: Foundations
- [x] Monorepo layout, README, architecture/data-model/API docs, ADRs
- [x] Install toolchain (Homebrew, JDK 25, Node 24 LTS, Colima/Docker, AWS CLI, AWS CDK)
- [x] GitHub Actions CI: backend build + Testcontainers, CDK tests + synth, mobile lint/typecheck/tests
- [x] Push to GitHub (private repo MMusa39/progression)

## Phase 1: Backend core
- [x] Spring Boot project (Gradle), Docker Compose PostgreSQL
- [x] Flyway schema (V1) + seeded exercise catalog (V2)
- [x] Exercises API, Workouts API (idempotent PUT), "last performance" endpoint
- [x] Problem Details error handling, validation
- [x] Unit tests + Testcontainers integration tests (35 tests)
- [x] OpenAPI / Swagger UI
- [x] JWT resource server with local dev tokens (pulled forward from Phase 4)

## Phase 2: Mobile core
- [x] Expo SDK 57 app with TypeScript, Expo Router, native tabs, design tokens (dark-first + light mode)
- [x] Workout logging screen: add exercises, add/edit/complete sets, set types, PREVIOUS column, one-tap suggestions
- [x] Exercise picker with search, muscle filters, multi-select, custom exercises
- [x] History list (infinite scroll), workout detail, repeat workout, delete
- [x] API client + TanStack Query; persisted active workout; offline-tolerant upload queue
- [x] Unit tests (Jest), lint, typecheck

## Phase 3: Progress & insights
- [x] `working_set` view + `estimated_one_rep_max` SQL function (V3 migration)
- [x] Stats endpoints: summary (totals, previous-period comparison, streak, time-zone-aware weekly/monthly buckets, muscle split), per-exercise progression, exercise records, workout PRs
- [x] Custom SVG charts (line chart + sparkline) following the dataviz guidelines: touch scrubbing, validated colors
- [x] Simplified after on-device testing: dropped volume/tonnage, muscle-group split and volume charts; added recent PRs and range-scoped lift progress (ADR 0007)
- [x] Time-range filter: 4W / 3M / 6M / 1Y / All + custom "last N weeks/months", shared across screens
- [x] Progress tab (workouts, streak, recent PRs, lifts with strength change), per-exercise screen (chart + sessions + records), PR badges in history, "Workout complete" PR celebration
- [x] Dev data seed script + web preview for visual checks

## Phase 4: Authentication
- [x] Cognito User Pool with email + phone sign-in and Google federation (CDK, `Progression-Auth`)
- [x] Spring Security resource server; multi-issuer (Cognito + local dev tokens)
- [x] Sign-up / verify / sign-in / forgot-password screens; Google via OAuth + PKCE
- [ ] Deploy the stack and configure Google OAuth client (needs your AWS + Google accounts; see infra/README.md)
- [ ] Link email and Google accounts with the same address (pre-sign-up Lambda)

## Phase 5: Workflow features
- [ ] Templates / routines
- [x] Rest timer: auto-starts on each completed set, ±15s / skip, haptic at the end, default length in Profile
- [ ] Rest-over notification while the app is in the background
- [ ] Progressive-overload suggestions

## Phase 6: Offline-first sync
- [ ] SQLite store on device, sync queue with retries, conflict handling

## Phase 7: Cloud deployment
- [ ] CDK stacks: network, database, service (ECS Fargate + ALB), auth
- [ ] GitHub Actions: build, test, push image to ECR, deploy
- [ ] CloudWatch logs, alarms; cost notes and teardown instructions
