package com.progression.stats;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

import com.progression.exercise.Equipment;
import com.progression.exercise.MuscleGroup;

/**
 * One exercise's history as a time series: one point per workout that
 * included it, oldest first. Weights are kilograms; the app converts to the
 * user's unit.
 */
public record ExerciseProgressionResponse(
		UUID exerciseId,
		String exerciseName,
		MuscleGroup muscleGroup,
		Equipment equipment,
		List<Point> points) {

	/**
	 * @param bestE1rmKg     highest estimated one-rep max among the session's sets
	 * @param topSetWeightKg heaviest weight lifted in the session
	 * @param topSetReps     reps performed at that heaviest weight
	 * @param bestReps       most reps in a single set (the key measure for bodyweight exercises)
	 * @param setCount       working sets performed
	 */
	public record Point(
			UUID workoutId,
			Instant performedAt,
			double bestE1rmKg,
			double topSetWeightKg,
			int topSetReps,
			int bestReps,
			int setCount) {
	}
}
