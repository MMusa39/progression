package com.progression.user;

import java.time.Instant;
import java.util.UUID;

import com.progression.common.WeightUnit;

/** The current user's profile and preferences. */
public record UserResponse(UUID id, String email, String displayName, WeightUnit weightUnit, Instant createdAt) {

	static UserResponse from(AppUser user) {
		return new UserResponse(user.getId(), user.getEmail(), user.getDisplayName(), user.getWeightUnit(),
				user.getCreatedAt());
	}
}
