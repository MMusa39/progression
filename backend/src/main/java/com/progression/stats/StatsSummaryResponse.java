package com.progression.stats;

import java.time.Instant;

/**
 * Consistency at a glance, for the top of the Progress tab.
 *
 * @param from               start of the range, or {@code null} for all time
 * @param workouts           workouts logged within the range
 * @param previousWorkouts   workouts in the equally long period just before the range
 *                           (for "+2 vs previous 4 weeks"); {@code null} for all time
 * @param currentStreakWeeks consecutive weeks, up to this one, with at least one workout.
 *                           A week with no workout yet doesn't break the streak until it ends
 */
public record StatsSummaryResponse(Instant from, int workouts, Integer previousWorkouts, int currentStreakWeeks) {
}
