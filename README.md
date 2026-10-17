# Progression

**Progression** is a mobile workout tracker for people who lift. It replaces the
"exercise name, weight, reps, reps, reps" notes-app workflow with a fast logging
screen, and shows how each lift is progressing over time. It also tracks body
weight and food (barcode scanning, recipes, calorie and macro targets), so
training, nutrition and the scale live in one app.

> Status: feature-complete for a first release; deployment and App Store
> submission are next. See [docs/release.md](docs/release.md) and
> [docs/roadmap.md](docs/roadmap.md).

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
| Friends | Add friends by @username or invite link, see each other's PRs and workouts (or share PRs only), and compare on a consistency leaderboard (with a winner) and per-lift strength rankings. |
| Routines | Save your usual workouts (exercises, sets, rep ranges), start them in one tap, or turn any past workout into a routine. |
| Repeat & edit | Start a new workout from any past one with one tap, or fix mistakes in a saved workout. |
| Rest timer | Starts automatically when you tick off a set; adjust ±15s or skip; buzzes when rest is over, with a notification if you've left the app. |
| Notifications | Friend requests, accepted invites, and friends' new PRs, each switchable in Profile. |
| Body weight | Log a daily weigh-in; see a smoothed trend that ignores water swings, your weekly rate, and when you'll reach your goal. |
| Food diary | Breakfast / lunch / dinner / snacks with calories, protein, carbs, fat and fiber against your targets. Search foods, re-log recents, copy a previous day's meal, quick-add calories, track water. |
| Barcode scanning | Scan a product to log it (Open Food Facts, 3M+ products). Unknown barcodes can be added from the label once and are found next time. |
| Recipes | Build a recipe from ingredients, log servings in one tap, and share it with friends, who can save their own copy. |
| Calorie & macro targets | From sex, age, height, weight, goal weight, timeline and activity, with safe-pace limits, and adaptive maintenance that learns from what you log and how your weight responds. Or enter your own macros (e.g. from a coach). Everything lives on one **My Plan** screen. |
| Nutrition trends | How consistently you hit calories, protein, carbs and fat: "18 of 26 days on target", a bar per day against your target zone, weekly averages, and your logging streak. |
| Gym helpers | Notes per exercise that carry over to next time ("Seat at 4"), a plate calculator for barbell lifts, and a weekly workout goal on the Workout tab. |
| Progressive overload | "Today: 190 lb × 6": hit the top of your rep range on every set and it suggests adding weight, otherwise one more rep. The suggestion pre-fills the set, so following it is one tap. |
| Works offline | Gyms have bad signal: workouts save on the phone as you log and sync when you're back online. |
| Your data | Export everything as JSON, or delete your account and all data, from the app. |

## Tech stack

| Layer | Technology |
| --- | --- |
| Mobile | React Native, Expo SDK 57, TypeScript, Expo Router, TanStack Query, zustand |
| Backend | Java 25, Spring Boot 4, Spring Data JPA, Spring Security |
| Database | PostgreSQL 18, Flyway migrations |
| Auth | Amazon Cognito: email, phone, or Google sign-in (JWT access tokens) |
| Infrastructure | AWS CDK (Java): ECS Fargate (ARM64), RDS PostgreSQL, internal ALB behind CloudFront, Cognito |
| Quality | JUnit 5, Testcontainers, CDK assertions, Jest, Playwright (web E2E smoke test), ESLint, GitHub Actions CI |

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
- [Testing](docs/testing.md): what's tested automatically, by hand, and what still needs a real iPhone
- [Release checklist](docs/release.md): what's done and the steps to ship to the App Store
- [Roadmap](docs/roadmap.md): delivery phases and progress
- [Architecture Decision Records](docs/adr/): why key technical choices were made
