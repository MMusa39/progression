package com.progression.exercise;

import java.util.UUID;

/**
 * @param custom {@code true} if the current user created this exercise, {@code false} for catalog exercises
 */
public record ExerciseResponse(UUID id, String name, MuscleGroup muscleGroup, Equipment equipment, boolean custom) {

	public static ExerciseResponse from(Exercise exercise) {
		return new ExerciseResponse(exercise.getId(), exercise.getName(), exercise.getMuscleGroup(),
				exercise.getEquipment(), exercise.isCustom());
	}
}
