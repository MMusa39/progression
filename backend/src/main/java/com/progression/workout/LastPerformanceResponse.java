package com.progression.workout;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

/**
 * What the user did the last time they performed an exercise. The app shows it
 * inline while logging, e.g. "Last time: 185 × 8, 8, 7".
 */
public record LastPerformanceResponse(
		UUID workoutId,
		String workoutName,
		Instant performedAt,
		List<WorkoutResponse.SetEntry> sets) {

	static LastPerformanceResponse from(WorkoutExercise workoutExercise) {
		Workout workout = workoutExercise.getWorkout();
		return new LastPerformanceResponse(
				workout.getId(),
				workout.getName(),
				workout.getStartedAt(),
				workoutExercise.getSets().stream().map(WorkoutResponse.SetEntry::from).toList());
	}
}
