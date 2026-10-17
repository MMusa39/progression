package com.progression.workout;

import java.time.Instant;
import java.util.UUID;

/**
 * Published after a workout is saved (created or updated). Listeners run after
 * the transaction commits, so they always see the saved data.
 *
 * @param created   true the first time this workout is saved; false for edits and retries
 * @param startedAt when the workout started (lets listeners ignore back-filled old workouts)
 */
public record WorkoutSavedEvent(UUID userId, UUID workoutId, boolean created, Instant startedAt) {
}
