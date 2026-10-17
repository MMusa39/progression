package com.progression.stats;

import java.math.BigDecimal;
import java.util.UUID;

import com.progression.common.WeightUnit;

/**
 * A personal record set in a specific workout: the value beat everything the
 * user had done on that exercise in earlier workouts.
 *
 * @param setId      the set that achieved it; {@code null} for {@link RecordType#SESSION_VOLUME}
 * @param valueKg    the new best, in kilograms
 * @param previousKg the best before this workout, in kilograms
 * @param weight     the set's weight as entered (for display), when {@code setId} is set
 * @param weightUnit unit the set was logged in
 * @param reps       the set's reps
 */
public record PersonalRecordResponse(
		UUID exerciseId,
		String exerciseName,
		RecordType type,
		UUID setId,
		double valueKg,
		double previousKg,
		BigDecimal weight,
		WeightUnit weightUnit,
		Integer reps) {
}
