package com.progression.stats;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

import com.progression.exercise.Equipment;
import com.progression.exercise.MuscleGroup;

/**
 * All-time summary of one exercise the user has performed: their personal
 * records plus a short trend, for the exercise list on the Progress tab.
 *
 * @param recentBestE1rmKg best estimated 1RM of each of the last (up to) 8 sessions,
 *                         oldest first, for a sparkline
 */
public record ExerciseStatsResponse(
		UUID exerciseId,
		String exerciseName,
		MuscleGroup muscleGroup,
		Equipment equipment,
		int sessions,
		Instant lastPerformedAt,
		double bestE1rmKg,
		Instant bestE1rmAt,
		double heaviestWeightKg,
		int bestReps,
		List<Double> recentBestE1rmKg) {
}
