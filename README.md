# Progression

**Progression** is a mobile workout tracker for people who lift. It replaces the
"exercise name, weight, reps, reps, reps" notes-app workflow with a fast logging
screen, and shows how each lift is progressing over time.

> Status: early development. See [docs/roadmap.md](docs/roadmap.md) for what is
> done and what is next.

## Why this exists

Most lifters track their workouts in their phone's notes app:

```
Bench Press
185 x 8, 8, 7
Incline DB Press
60 x 10, 10, 9
```

That works for one session but falls apart over months. You can't easily answer:

- *What did I do last time on this lift?*
- *Am I actually getting stronger?*
- *When did I last hit a PR?*

Progression keeps the same speed as a note but stores structured data, so it can
answer those questions for you.

## Features

| Feature | Description |
| --- | --- |
| Sign up your way | Create an account with email, phone number, or Google. |
| Fast set logging | Log weight × reps per set in a few taps, with sensible defaults copied from your last set. |
| "Last time" inline | While logging an exercise, see exactly what you did last session. |
| Strength progress | For every lift: how much stronger you got over the range, and a chart of estimated 1-rep max or heaviest weight per session. Touch and drag to read any session. |
| Any time range | Last 4 weeks, 3 / 6 / 12 months, all time, or any custom "last N weeks/months". |
| Personal records | Automatic detection of new PRs (heaviest weight, best estimated 1RM), celebrated when you finish, listed on the Progress tab, and badged in history. |
| Streaks | Consecutive weeks trained, counted in your own time zone. |
| Templates | Save routines like "Push Day" and start a workout pre-filled from the last time you ran it. |
| Rest timer | Starts automatically after each completed set. |
| Overload hints | Suggests when to add weight based on your recent performance. |
| Offline-first | Gyms have bad signal; workouts are saved on the phone and synced when possible. |

## Tech stack

| Layer | Technology |
| --- | --- |
| Mobile | React Native, Expo SDK 57, TypeScript, Expo Router, TanStack Query, zustand |
| Backend | Java 25, Spring Boot 4, Spring Data JPA, Spring Security |
| Database | PostgreSQL 18, Flyway migrations |
| Auth | Amazon Cognito: email, phone, or Google sign-in (JWT access tokens) |
| Infrastructure | AWS CDK (Java): ECS Fargate, RDS PostgreSQL, Application Load Balancer |
| Quality | JUnit 5, Testcontainers, CDK assertions, Jest, ESLint, GitHub Actions CI |

## Repository layout

```
progression/
├── backend/   Spring Boot REST API (Java)
├── mobile/    Expo / React Native app (TypeScript)
├── infra/     AWS CDK app that defines the cloud infrastructure (Java)
└── docs/      Architecture, data model, API, roadmap and decision records
```

## Documentation

- [Architecture](docs/architecture.md): how the pieces fit together
- [Data model](docs/data-model.md): database schema and the reasoning behind it
- [API](docs/api.md): REST endpoints and contracts
- [Backend README](backend/README.md): running, testing and navigating the API code
- [Mobile README](mobile/README.md): running the app on your phone, structure, how auth and logging work
- [Infrastructure README](infra/README.md): deploying Cognito, Google and SMS setup, costs
- [Development setup](docs/development-setup.md): tools to install and how to run everything locally
- [Roadmap](docs/roadmap.md): delivery phases and progress
- [Architecture Decision Records](docs/adr/): why key technical choices were made
