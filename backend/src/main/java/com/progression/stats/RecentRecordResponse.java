package com.progression.stats;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.UUID;

import com.progression.common.WeightUnit;

/**
 * A personal record achieved at some point in a time range, e.g. "Bench Press,
 * Oct 12: heaviest weight 225 lb × 3 (previous best 215 lb)".
 *
 * @param valueKg    the new best, in kilograms
 * @param previousKg the best before that session, in kilograms
 * @param weight     weight of the record set, as logged
 * @param weightUnit unit it was logged in
 * @param reps       reps of the record set
 */
public record RecentRecordResponse(
		UUID exerciseId,
		String exerciseName,
		UUID workoutId,
		Instant achievedAt,
		RecordType type,
		double valueKg,
		double previousKg,
		BigDecimal weight,
		WeightUnit weightUnit,
		int reps) {
}
