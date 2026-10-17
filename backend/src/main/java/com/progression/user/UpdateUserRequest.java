package com.progression.user;

import com.progression.common.WeightUnit;
import jakarta.validation.constraints.Size;

/**
 * Body of {@code PATCH /api/v1/me}. Every field is optional; {@code null} means
 * "leave unchanged". An empty display name clears it.
 *
 * @param username      3–20 characters: letters, digits, underscores and dots (stored lowercase)
 * @param shareWorkouts whether friends may see individual workouts (PRs are always shared)
 */
public record UpdateUserRequest(
		@Size(max = 50) String displayName,
		WeightUnit weightUnit,
		@Size(max = 21) String username,
		Boolean shareWorkouts) {
}
