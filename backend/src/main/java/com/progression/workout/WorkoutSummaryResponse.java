package com.progression.workout;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

/**
 * Compact form of a workout for the history list.
 *
 * @param exerciseNames names in display order, for a preview like "Bench Press, Incline DB Press, ..."
 * @param setCount      number of completed non-warm-up sets
 */
public record WorkoutSummaryResponse(
		UUID id,
		String name,
		Instant startedAt,
		Instant endedAt,
		List<String> exerciseNames,
		int setCount) {

	static WorkoutSummaryResponse from(Workout workout) {
		long setCount = workout.getExercises().stream()
				.flatMap(we -> we.getSets().stream())
				.filter(set -> set.getCompletedAt() != null && set.getSetType().countsTowardStats())
				.count();

		return new WorkoutSummaryResponse(
				workout.getId(),
				workout.getName(),
				workout.getStartedAt(),
				workout.getEndedAt(),
				workout.getExercises().stream().map(we -> we.getExercise().getName()).toList(),
				(int) setCount);
	}
}
