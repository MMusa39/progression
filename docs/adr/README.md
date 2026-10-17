# Architecture Decision Records

An ADR is a short document that captures one significant technical decision:
the context, the options considered, what was chosen, and the consequences.
They are never edited after acceptance. If a decision changes, a new ADR
supersedes the old one, so the history of *why* is preserved.

| # | Title | Status |
| --- | --- | --- |
| [0001](0001-react-native-expo-for-mobile.md) | React Native + Expo for the mobile app | Accepted |
| [0002](0002-spring-boot-and-postgresql.md) | Spring Boot and PostgreSQL for the backend | Accepted |
| [0003](0003-client-generated-ids-and-idempotent-upserts.md) | Client-generated IDs and idempotent upserts | Accepted |
| [0004](0004-local-first-aws-later.md) | Develop locally, deploy to AWS with CDK later | Accepted |
| [0005](0005-cognito-authentication.md) | Cognito with custom screens for email, phone, and Google sign-in | Accepted |
| [0006](0006-custom-svg-charts.md) | Custom SVG charts instead of a charting library | Accepted |
| [0007](0007-focus-progress-on-strength.md) | Focus progress tracking on strength, records and consistency | Accepted |
| [0008](0008-friends-and-privacy.md) | Mutual friends, private by default, and two kinds of leaderboard | Accepted |
| [0009](0009-push-notifications.md) | Push via Expo, triggered by domain events after commit | Accepted |
| [0010](0010-food-tracking-and-targets.md) | Food tracking: Open Food Facts, snapshotted entries, adaptive targets | Accepted |
| [0011](0011-nutrition-adherence.md) | Measure nutrition consistency as "days on target", not averages alone | Accepted |
| [0012](0012-deployment-architecture.md) | Deploy behind CloudFront with a VPC origin, without a NAT gateway | Accepted |
