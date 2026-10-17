package com.progression.user;

import com.progression.common.WeightUnit;
import jakarta.validation.constraints.Size;

/**
 * Body of {@code PATCH /api/v1/me}. Every field is optional; {@code null} means
 * "leave unchanged". An empty display name clears it.
 */
public record UpdateUserRequest(@Size(max = 50) String displayName, WeightUnit weightUnit) {
}
