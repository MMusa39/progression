package com.progression.exercise;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

/** Body of {@code POST /api/v1/exercises}: a new custom exercise. */
public record CreateExerciseRequest(
		@NotBlank @Size(max = 100) String name,
		@NotNull MuscleGroup muscleGroup,
		@NotNull Equipment equipment) {
}
