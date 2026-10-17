package com.progression.stats;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

import com.progression.exercise.Equipment;
import com.progression.exercise.MuscleGroup;

/**
 * One exercise the user performed within a time range: how it moved in that
 * range, plus their all-time bests for context.
 *
 * @param sessions         sessions within the range
 * @param rangeBestE1rmKg  best estimated 1RM of each session in the range, oldest first.
 *                         The change from first to last is "how much stronger in this range"
 * @param rangeBestReps    most reps in a single set per session in the range, oldest first
 *                         (the progress measure for bodyweight exercises)
 * @param bestE1rmKg       all-time best estimated 1RM
 * @param heaviestWeightKg all-time heaviest weight lifted
 * @param bestReps         all-time most reps in a set
 */
public record ExerciseStatsResponse(
		UUID exerciseId,
		String exerciseName,
		MuscleGroup muscleGroup,
		Equipment equipment,
		int sessions,
		Instant lastPerformedAt,
		List<Double> rangeBestE1rmKg,
		List<Integer> rangeBestReps,
		double bestE1rmKg,
		Instant bestE1rmAt,
		double heaviestWeightKg,
		int bestReps) {
}
