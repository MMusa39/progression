# 0008: Mutual friends, private by default, and two kinds of leaderboard

- **Status:** Accepted
- **Date:** 2026-10-16

## Context
Users want to add friends, see their workouts, and compete on leaderboards.
Workout logs are personal data (body weight lifted, training times and habits),
and the app's design rule is to show only what helps (ADR 0007).

## Decision
- **Mutual friendships** (request → accept), not one-way follows. Nobody sees
  your training unless you approved them. One row per pair, enforced by a
  unique index on the unordered pair.
- **Finding people:** a unique @username (search by prefix) or an **invite
  link/code**. Opening someone's invite connects immediately, because sharing it is
  the owner's consent. Codes can be reset to revoke old links. No address-book access.
- **Visibility:** friends always see PRs and consistency. Individual workouts are
  shared by default but can be turned off ("PRs only"). Strangers get 404 on
  everything, so the API doesn't confirm that an account exists or has data.
- **Leaderboards:**
  - *Consistency* (weekly streak, then workouts in 4 weeks) **crowns a winner**:
    anyone can win it by showing up.
  - *Strength* (best estimated 1RM per lift) is a **ranking without a winner**:
    absolute strength mostly reflects body size and training age, so a crown
    there would reward the wrong thing.

## Consequences
- The privacy rules live in one service (`FriendService`), so every friend
  endpoint applies the same checks, and integration tests cover strangers,
  "PRs only", and unfriending.
- Streaks for friends use the viewer's time zone (user time zones aren't
  stored), so a friend's streak can differ by a day at week boundaries.
- Relative-strength boards (lift ÷ bodyweight) would need bodyweight tracking.
  Push notifications for requests and PRs are future work.
