package com.progression.stats;

import java.time.Instant;
import java.time.LocalDate;
import java.util.List;

import com.progression.exercise.MuscleGroup;

/**
 * Overview of training over a time range, for the Progress tab.
 *
 * @param from               start of the range, or {@code null} for all time
 * @param bucket             resolved bucket size of {@link #buckets} (never AUTO)
 * @param totals             totals within the range
 * @param previousTotals     totals over the equally long period just before the range
 *                           (for "vs previous period" deltas); {@code null} for all time
 * @param currentStreakWeeks consecutive weeks, up to this one, with at least one workout.
 *                           A week with no workout yet doesn't break the streak until it ends
 * @param buckets            one entry per week/month in the range, oldest first, including
 *                           empty ones, so a chart shows gaps honestly
 * @param muscleGroups       working sets per muscle group within the range, most first
 */
public record StatsSummaryResponse(
		Instant from,
		Bucket bucket,
		Totals totals,
		Totals previousTotals,
		int currentStreakWeeks,
		List<BucketPoint> buckets,
		List<MuscleGroupSets> muscleGroups) {

	public record Totals(int workouts, int sets, int reps, double volumeKg) {

		static final Totals EMPTY = new Totals(0, 0, 0, 0);
	}

	/** @param start first day of the week (Monday) or month, in the requested time zone */
	public record BucketPoint(LocalDate start, int workouts, int sets, double volumeKg) {
	}

	public record MuscleGroupSets(MuscleGroup muscleGroup, int sets) {
	}
}
