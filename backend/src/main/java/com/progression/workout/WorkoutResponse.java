package com.progression.workout;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.List;
import java.util.UUID;

import com.progression.common.WeightUnit;
import com.progression.exercise.Equipment;
import com.progression.exercise.MuscleGroup;

/** A full workout with its exercises and sets, in display order. */
public record WorkoutResponse(
		UUID id,
		String name,
		Instant startedAt,
		Instant endedAt,
		String notes,
		Instant updatedAt,
		List<ExerciseEntry> exercises) {

	public record ExerciseEntry(
			UUID id,
			UUID exerciseId,
			String exerciseName,
			MuscleGroup muscleGroup,
			Equipment equipment,
			String notes,
			List<SetEntry> sets) {
	}

	public record SetEntry(
			UUID id,
			SetType setType,
			BigDecimal weight,
			WeightUnit weightUnit,
			int reps,
			BigDecimal rpe,
			Instant completedAt) {

		static SetEntry from(ExerciseSet set) {
			return new SetEntry(set.getId(), set.getSetType(), set.getWeight(), set.getWeightUnit(), set.getReps(),
					set.getRpe(), set.getCompletedAt());
		}
	}

	static WorkoutResponse from(Workout workout) {
		List<ExerciseEntry> exercises = workout.getExercises().stream()
				.map(we -> new ExerciseEntry(
						we.getId(),
						we.getExercise().getId(),
						we.getExercise().getName(),
						we.getExercise().getMuscleGroup(),
						we.getExercise().getEquipment(),
						we.getNotes(),
						we.getSets().stream().map(SetEntry::from).toList()))
				.toList();
		return new WorkoutResponse(workout.getId(), workout.getName(), workout.getStartedAt(), workout.getEndedAt(),
				workout.getNotes(), workout.getUpdatedAt(), exercises);
	}
}
