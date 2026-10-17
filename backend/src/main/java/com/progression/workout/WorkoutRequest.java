package com.progression.workout;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.List;
import java.util.UUID;

import com.progression.common.WeightUnit;
import jakarta.validation.Valid;
import jakarta.validation.constraints.DecimalMax;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.Digits;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

/**
 * Body of {@code PUT /api/v1/workouts/{id}}: the <em>complete</em> state of a
 * workout. Exercises and sets are ordered by their position in the arrays.
 * Anything left out of the request is removed from the stored workout.
 */
public record WorkoutRequest(
		@NotBlank @Size(max = 100) String name,
		@NotNull Instant startedAt,
		Instant endedAt,
		@Size(max = 2000) String notes,
		/** When the client last changed this workout; older writes are rejected with 409. */
		@NotNull Instant updatedAt,
		@NotNull @Size(max = 50) List<@Valid @NotNull ExerciseEntry> exercises) {

	public record ExerciseEntry(
			/** Client-generated id of this exercise-within-the-workout. */
			@NotNull UUID id,
			/** Which exercise definition (catalog or custom) was performed. */
			@NotNull UUID exerciseId,
			@Size(max = 1000) String notes,
			@NotNull @Size(max = 50) List<@Valid @NotNull SetEntry> sets) {
	}

	public record SetEntry(
			@NotNull UUID id,
			@NotNull SetType setType,
			@NotNull @DecimalMin("0") @Digits(integer = 5, fraction = 2) BigDecimal weight,
			@NotNull WeightUnit weightUnit,
			@NotNull @Min(0) @Max(1000) Integer reps,
			@DecimalMin("1") @DecimalMax("10") @Digits(integer = 2, fraction = 1) BigDecimal rpe,
			/** When the set was ticked off; {@code null} for planned sets that weren't done yet. */
			Instant completedAt) {
	}
}
