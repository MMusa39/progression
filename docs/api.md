# API

REST + JSON, versioned under `/api/v1`. Once the backend is running, interactive
OpenAPI documentation is served at `http://localhost:8080/swagger-ui.html`.
This page is the human-oriented overview; the OpenAPI spec is the exact contract.

## Conventions

- **Auth:** every endpoint except `/actuator/health` requires
  `Authorization: Bearer <JWT>`.
- **IDs:** UUID strings. Clients create IDs for workouts, workout exercises and
  sets.
- **Timestamps:** ISO-8601 in UTC, e.g. `2026-10-16T18:30:00Z`.
- **Errors:** RFC 9457 Problem Details (`application/problem+json`). Validation
  failures include an `errors` array with every invalid field:
  ```json
  {
    "title": "Validation Failed",
    "status": 400,
    "detail": "Request validation failed",
    "instance": "/api/v1/workouts/5b1f...",
    "errors": [{ "field": "exercises[0].sets[2].reps", "message": "must be greater than or equal to 0" }]
  }
  ```
- **Not found vs. forbidden:** another user's resource returns `404`, exactly
  like a missing one, so the API never reveals that it exists.
- **Pagination:** cursor-based (`?cursor=...&limit=20`) for history lists, so
  results stay stable while new workouts are being added.
- **Rate limits:** 300 requests per minute per user, and 30 per minute for food
  lookups/searches and data exports. Over the limit: `429 Too Many Requests` with
  a `Retry-After` header (seconds) and a problem-details body.

## Development-only

| Method | Path | Description |
| --- | --- | --- |
| `POST` | `/dev/token` | `{"subject": "dev-user", "email": "optional"}` → `{ accessToken, expiresAt }`. Mints a signed token for local testing. Only exists under the `local`/`test` profiles. |

## Endpoints

### User

| Method | Path | Description |
| --- | --- | --- |
| `GET` | `/me` | Current user's profile, created automatically on first call. |
| `PATCH` | `/me` | Update display name or preferred weight unit. |
| `GET` | `/me/export` | Everything you've stored, as one JSON document (`format: progression-export-v1`): account, workouts with sets, routines, custom exercises and foods, recipes, food diary, weigh-ins, plan, water, friends. Sent as a download (`Content-Disposition`). |
| `DELETE` | `/me` | Permanently delete your account and all of its data (`204`). Friends' saved copies of your shared recipes are theirs and remain. |

### Exercises

| Method | Path | Description |
| --- | --- | --- |
| `GET` | `/exercises?query=bench` | Built-in catalog plus the user's custom exercises, optionally filtered by name. |
| `POST` | `/exercises` | Create a custom exercise. |
| `GET` | `/exercises/{id}/last-performance?excludeWorkoutId=` | Sets from the most recent workout that included this exercise. Powers the "Last time" hint. Pass the in-progress workout as `excludeWorkoutId`. `204 No Content` if never performed. |

### Workouts

| Method | Path | Description |
| --- | --- | --- |
| `GET` | `/workouts?cursor=&limit=` | Workout history, newest first: `{ items: [...], nextCursor }`. `limit` defaults to 20 (max 50); pass `nextCursor` back as `cursor` for the next page. |
| `GET` | `/workouts/{id}` | Full workout with exercises and sets. |
| `PUT` | `/workouts/{id}` | **Idempotent upsert** of a full workout. Used for both creating and updating. |
| `DELETE` | `/workouts/{id}` | Delete a workout. Idempotent: returns `204` even if it was already gone. |

Example `PUT /api/v1/workouts/8f0c...`. Exercises and sets are ordered by their
position in the arrays, and anything omitted is deleted:

```json
{
  "name": "Push Day",
  "startedAt": "2026-10-16T18:02:00Z",
  "endedAt": "2026-10-16T19:10:00Z",
  "updatedAt": "2026-10-16T19:10:05Z",
  "exercises": [
    {
      "id": "c2a1...",
      "exerciseId": "e-bench-press-uuid",
      "sets": [
        { "id": "s1...", "setType": "WARMUP",  "weight": 135, "weightUnit": "LB", "reps": 10 },
        { "id": "s2...", "setType": "WORKING", "weight": 185, "weightUnit": "LB", "reps": 8, "completedAt": "2026-10-16T18:09:30Z" },
        { "id": "s3...", "setType": "WORKING", "weight": 185, "weightUnit": "LB", "reps": 8 },
        { "id": "s4...", "setType": "WORKING", "weight": 185, "weightUnit": "LB", "reps": 7 }
      ]
    }
  ]
}
```

Responses: `200 OK` (updated) or `201 Created` (new), with the saved workout.
`409 Conflict` if the server already holds a newer `updatedAt`.

### Stats

Progress is reported around the three questions a lifter actually asks: *is
each lift getting stronger, did I set any records, am I training consistently?*
Everything is computed on demand from completed, non-warm-up sets (the
`working_set` view). Weights are returned in **kilograms**; the app converts
them to the user's unit. A time range is a `from` instant (the app sends
"N weeks/months ago at local midnight"); omit it for all time.

| Method | Path | Description |
| --- | --- | --- |
| `GET` | `/stats/summary?from=&tz=` | Consistency: `workouts` in the range, `previousWorkouts` in the equally long period before it (`null` for all time), and `currentStreakWeeks`, the consecutive weeks with a workout, counted in the user's IANA time zone `tz` (default `UTC`). |
| `GET` | `/stats/exercises?from=` | Each exercise trained in the range, most recent first: session count, best estimated 1RM (and best reps) of **each session in the range** (`rangeBestE1rmKg`, `rangeBestReps`, oldest first; first→last is "how much it moved"), plus all-time bests. |
| `GET` | `/stats/exercises/{id}/progression?from=` | One point per session for a chart: best estimated 1RM, top set (weight + reps), best reps, set count. |
| `GET` | `/stats/records?from=` | Personal records set in the range, newest first (max 30): `ESTIMATED_1RM` or `HEAVIEST_WEIGHT`, with the record set as logged and the previous best. |
| `GET` | `/workouts/{id}/records` | Personal records set in that workout, compared with all workouts that **started before it**. |

A first-ever session of an exercise never counts as a record: there's nothing
to beat yet. **Estimated one-rep max** uses the Epley formula,
`weight × (1 + reps / 30)`, with a single rep counted as-is. It's defined once,
as the SQL function `estimated_one_rep_max`, so every endpoint agrees.

Example `GET /api/v1/stats/records?from=2026-09-18T04:00:00Z`:

```json
[
  {
    "exerciseId": "…", "exerciseName": "Back Squat", "workoutId": "…",
    "achievedAt": "2026-10-16T18:58:00Z", "type": "HEAVIEST_WEIGHT",
    "valueKg": 117.93, "previousKg": 115.67, "weight": 260, "weightUnit": "LB", "reps": 6
  }
]
```

### Friends

Friendships are **mutual**: one person requests, the other accepts. Everything
here is scoped to accepted friends. A non-friend gets `404` for any friend
endpoint, so the API never confirms what a stranger has logged.

| Method | Path | Description |
| --- | --- | --- |
| `PATCH` | `/me` | Also sets `username` (3–20 chars: a–z, 0–9, `_`, `.`; stored lowercase, unique) and `shareWorkouts`. |
| `GET` | `/users/search?q=` | Username prefix search (min 2 chars) with your `relationship` to each result: `NONE`, `REQUEST_SENT`, `REQUEST_RECEIVED`, `FRIENDS`. |
| `POST` | `/friends/requests` | `{ "username": "mike" }`. Sends a request, or accepts theirs if they already asked you. Requires your own username. |
| `GET` | `/friends/requests` | `{ incoming, outgoing }` pending requests. |
| `POST` | `/friends/requests/{id}/accept` | Accept an incoming request. |
| `DELETE` | `/friends/requests/{id}` | Decline (incoming) or cancel (outgoing). |
| `GET` | `/friends/invite` | Your invite code (8 characters, no look-alike characters). The app shares it as `progression://invite/CODE`. |
| `POST` | `/friends/invite/reset` | New code; old links stop working. |
| `GET` / `POST` | `/friends/invite/{code}` | Preview whose invite it is / use it. Using it connects you **immediately**: sharing the link is the owner's consent. |
| `GET` | `/friends?tz=` | Friends with `currentStreakWeeks`, `workoutsLast4Weeks`, `lastWorkoutAt`, `shareWorkouts`. |
| `GET` / `DELETE` | `/friends/{id}` | One friend's summary / unfriend. |
| `GET` | `/friends/{id}/records?from=` | A friend's PRs. Always shared with friends. |
| `GET` | `/friends/{id}/workouts`, `/friends/{id}/workouts/{workoutId}` | A friend's history and workouts. `403` if they've turned `shareWorkouts` off. |

### Leaderboards

Among you and your friends.

| Method | Path | Description |
| --- | --- | --- |
| `GET` | `/leaderboards/consistency?tz=` | Ranked by weekly streak, then workouts in the last 4 weeks. Ties share a rank, and `winner` is true for everyone at rank 1 who has trained. |
| `GET` | `/leaderboards/strength/exercises` | Catalog lifts anyone in the group has logged (weighted only), most shared first. |
| `GET` | `/leaderboards/strength?exerciseId=` | Best estimated 1RM per person on one lift (defaults to the most shared lift), with the set that produced it. A ranking with **no winner**. |

### Notifications

| Method | Path | Description |
| --- | --- | --- |
| `POST` | `/me/push-tokens` | `{ "token": "ExponentPushToken[…]", "platform": "IOS" \| "ANDROID" }`. Registers this device (idempotent; a token moves to whoever registers it last). |
| `DELETE` | `/me/push-tokens/{token}` | Stop sending to this device (the app calls it on sign-out). |
| `PATCH` | `/me` | `notifyFriendRequests`, `notifyFriendPrs` toggle each kind of push. |

Pushes are sent **after the triggering transaction commits**, asynchronously,
through Expo's push service:

| Event | Who is notified | Opens |
| --- | --- | --- |
| Friend request sent | The recipient | Friends tab |
| Request accepted / invite used | The original requester / invite owner | That friend |
| New workout with personal records (started < 48h ago, first save only) | All friends | That friend |

### Body weight

Private to the user. Weights are stored as entered (`weight` + `weightUnit`)
with a normalized `weightKg`, like sets.

| Method | Path | Description |
| --- | --- | --- |
| `PUT` | `/body-weights/{date}` | `{ "weight": 176.4, "weightUnit": "LB", "today": "2026-10-17" }`. One weigh-in per local calendar day (idempotent). `today` is the client's local date, so a date after it is rejected. |
| `DELETE` | `/body-weights/{date}` | Remove that day's weigh-in. |
| `GET` | `/body-weights?from=` | `{ entries, currentTrendKg, weeklyChangeKg, changeInRangeKg }`. Each entry has `trendKg`: an exponentially weighted moving average (10%/day, compounded over gaps). |

### Nutrition goal and targets

| Method | Path | Description |
| --- | --- | --- |
| `GET` | `/nutrition/profile` | Goal inputs, or `204` if not set up. |
| `PUT` | `/nutrition/profile` | `{ sex, birthYear, heightCm, activityLevel, goalWeight, weightUnit, goalDate, adaptive, currentWeight?, customMacros?, today }`. `currentWeight`, if given, is also logged as today's weigh-in. `customMacros: { proteinG, carbsG, fatG }` replaces the calculated macros (calories = 4/4/9 kcal per gram); omit or `null` for calculated targets. |
| `GET` | `/nutrition/targets?today=` | `{ targets, currentWeightKg, goalWeightKg, goalDate, adaptiveLoggedDays }`, or `204` without a profile. `targets` has `calories`, `proteinG`, `carbsG`, `fatG`, `fiberG`, `waterMl`, `bmr`, `formulaTdee`, `tdee`, `tdeeSource` (`FORMULA` / `ADAPTIVE`), `weeklyRateKg`, `goal`, `rateCapped`, `atCalorieFloor`, `projectedGoalDate`, `mode` (`CALCULATED` / `CUSTOM`). See [ADR 0010](adr/0010-food-tracking-and-targets.md) for the math. |
| `GET` | `/nutrition/trends?from=&today=` | Daily intake vs. today's targets: `{ from, to, days: [{ date, intake \| null }], goals, rules, summary }`. `summary` has `finishedDays`, `loggedDays`, `loggingStreak`, `average` and `onTarget: { calories, protein, carbs, fat }` (counts of logged days). The range starts no earlier than your first logged day; today is returned but not counted. Rules: calories ±10%, protein ≥ 90%, carbs/fat ±15% ([ADR 0011](adr/0011-nutrition-adherence.md)). |

### Foods

Nutrition is always **per 100 g** (or ml). A food is either cached from Open
Food Facts (shared) or a custom food (private to its creator).

| Method | Path | Description |
| --- | --- | --- |
| `GET` | `/foods/barcode/{code}` | Look up a barcode: cache first, then Open Food Facts (also tries the 13-digit form of a 12-digit UPC). `404` if unknown. |
| `GET` | `/foods/search?q=` | Name/brand search over your custom foods and cached products. |
| `GET` | `/foods/{id}` | One food (cached, or your own custom food). |
| `GET` | `/foods/mine` | Your custom foods. |
| `POST` | `/foods` | Create a custom food. `{ name, brand?, barcode?, servingG, servingLabel?, perServingValues: { kcal, proteinG?, carbsG?, fatG?, fiberG? } }`: values as printed on the label; stored per 100 g. `201`. |
| `GET` | `/foods/recent` | Recently logged foods and recipes, with the amount you used last time. |

### Food diary

| Method | Path | Description |
| --- | --- | --- |
| `GET` | `/diary/{date}` | `{ date, entries, totals, waterMl }` for one local day. |
| `PUT` | `/diary/entries/{id}` | Create or replace an entry (client-generated id). `{ date, meal, kind, foodId? \| recipeId? \| quick?, amount, amountUnit }`, where `meal` is `BREAKFAST`/`LUNCH`/`DINNER`/`SNACK`, `kind` is `FOOD`/`RECIPE`/`QUICK`, and `amountUnit` is `G`/`SERVING`. The server computes and **snapshots** the nutrition. |
| `DELETE` | `/diary/entries/{id}` | Remove an entry. |
| `POST` | `/diary/{date}/copy` | `{ fromDate, meal? }`: copy a day's entries (or one meal) into `date`. |
| `PUT` | `/diary/{date}/water` | `{ "ml": 2000 }`: set the day's water total. |

### Recipes

| Method | Path | Description |
| --- | --- | --- |
| `GET` | `/recipes` | Your recipes, each with `ingredients`, `total`, `perServing` and `shared`. |
| `GET` / `PUT` / `DELETE` | `/recipes/{id}` | Read / create-or-replace / delete. `PUT { name, servings, ingredients: [{ foodId, grams }], shared? }`; omitting `shared` keeps the current setting. Deleting doesn't change past diary entries. |
| `GET` | `/recipes/shared` | Recipes your friends have shared, with `sharedBy` and `savedCopyId` (your copy, if saved). |
| `GET` | `/recipes/shared/{id}` | One shared recipe. `404` unless it's shared and the owner is your friend. |
| `POST` | `/recipes/shared/{id}/copy` | `{ "id": "<new uuid>" }`: save your own copy (the owner's custom foods are copied too). Saving again returns the existing copy. |

### Routines

Reusable workout plans: an ordered list of exercises with target sets and a rep range.

| Method | Path | Description |
| --- | --- | --- |
| `GET` | `/routines` | Your routines, each with `exercises: [{ exerciseId, exerciseName, muscleGroup, equipment, sets, repMin, repMax }]`. |
| `GET` | `/routines/{id}` | One routine (`404` if it isn't yours). |
| `PUT` | `/routines/{id}` | Create or replace (client-generated id). `{ name, notes?, exercises: [{ exerciseId, sets (1–20), repMin, repMax }] }`; exercises must be catalog or your own. |
| `DELETE` | `/routines/{id}` | Delete a routine. Workouts logged from it are unaffected. |
