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
- [x] Edit past workouts (reuses the logger in edit mode; same idempotent save, original times kept)
- [ ] Templates / routines ("Repeat workout" covers the common case today)
- [x] Rest timer: auto-starts on each completed set, ±15s / skip, haptic at the end, default length in Profile
- [x] Rest-over notification while the app is in the background (local notification)
- [ ] Progressive-overload suggestions

## Phase 5b: Friends
- [x] Usernames, mutual friend requests, invite links/codes (V4 migration)
- [x] Friend profiles: streak, recent PRs, workouts (respecting "share workouts")
- [x] Leaderboards: consistency (crowns a winner), strength per lift (ranking only)
- [x] Privacy: non-friends see nothing (404); "PRs only" sharing (403 on workouts)
- [x] Push notifications for friend requests and friends' PRs (Expo push service, ADR 0009)

## Phase 5c: Body weight & nutrition
- [x] Fixed tab bar: Workout · Food · Progress · Friends · Profile (History moved into Workout)
- [x] Body weight: daily weigh-ins, smoothed trend, weekly rate, goal pace (V6)
- [x] Goal setup and calorie/macro/fiber/water targets with safe-pace caps (Mifflin-St Jeor)
- [x] Adaptive maintenance from logged intake vs. trend weight
- [x] Food diary: meals, quick add, copy previous day, recent foods, water (V7)
- [x] Barcode scanning (expo-camera) with Open Food Facts lookup and caching; custom foods from a label
- [x] Recipes, and sharing recipes with friends (save a copy) (V8)
- [x] Nutrition trends: days on target per nutrient, daily/weekly bars vs. target zone, weekly table, logging streak (ADR 0011)
- [x] My Plan screen (targets + details in one place), custom macro targets (V9)

## Phase 6: Offline-first sync
- [ ] SQLite store on device, sync queue with retries, conflict handling

## Phase 7: Cloud deployment
- [ ] CDK stacks: network, database, service (ECS Fargate + ALB), auth
- [ ] GitHub Actions: build, test, push image to ECR, deploy
- [ ] CloudWatch logs, alarms; cost notes and teardown instructions
