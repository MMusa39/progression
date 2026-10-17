# 0003: Client-generated IDs and idempotent upserts

- **Status:** Accepted
- **Date:** 2026-10-16

## Context
Lifters often train where there is little or no signal. Logging a set must
never fail because of the network, and a save request that times out must be
safe to retry.

## Decision
- The mobile app generates UUIDs for workouts, workout exercises, and sets.
- Workouts are saved as a whole with `PUT /api/v1/workouts/{id}`. The server
  creates the workout if it doesn't exist and replaces it otherwise.
- Each workout carries `updatedAt`. The server rejects a write that is older
  than its stored copy with `409 Conflict`.

## Consequences
- Retries cannot create duplicates, so the sync queue on the device can be simple.
- Sending the whole aggregate is slightly larger than sending deltas. A workout is a few KB, so this is negligible.
- Last-write-wins is acceptable because a workout is normally edited from one device at a time.
