package com.progression.workout;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.List;
import java.util.UUID;

/**
 * Compact form of a workout for the history list.
 *
 * @param exerciseNames  names in display order, for a preview like "Bench Press, Incline DB Press, ..."
 * @param setCount       number of completed non-warm-up sets
 * @param totalVolumeKg  sum of weight × reps over completed non-warm-up sets, in kilograms
 */
public record WorkoutSummaryResponse(
		UUID id,
		String name,
		Instant startedAt,
		Instant endedAt,
		List<String> exerciseNames,
		int setCount,
		BigDecimal totalVolumeKg) {

	static WorkoutSummaryResponse from(Workout workout) {
		List<ExerciseSet> countedSets = workout.getExercises().stream()
				.flatMap(we -> we.getSets().stream())
				.filter(set -> set.getCompletedAt() != null && set.getSetType().countsTowardStats())
				.toList();
		BigDecimal volume = countedSets.stream().map(ExerciseSet::volumeKg).reduce(BigDecimal.ZERO, BigDecimal::add);

		return new WorkoutSummaryResponse(
				workout.getId(),
				workout.getName(),
				workout.getStartedAt(),
				workout.getEndedAt(),
				workout.getExercises().stream().map(we -> we.getExercise().getName()).toList(),
				countedSets.size(),
				volume);
	}
}
