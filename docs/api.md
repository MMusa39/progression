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

| Method | Path | Description |
| --- | --- | --- |
| `GET` | `/stats/exercises/{id}/progression?metric=E1RM&range=6M` | Time series for a chart. `metric`: `E1RM`, `TOP_SET`, `VOLUME`. `range`: `1M`, `3M`, `6M`, `1Y`, `ALL`. |
| `GET` | `/stats/personal-records` | The user's current PRs per exercise. |
| `GET` | `/stats/weekly-volume?weeks=12` | Working-set volume per muscle group per week. |

### Templates

| Method | Path | Description |
| --- | --- | --- |
| `GET` | `/templates` | List the user's templates. |
| `PUT` | `/templates/{id}` | Create or replace a template. |
| `DELETE` | `/templates/{id}` | Delete a template. |
