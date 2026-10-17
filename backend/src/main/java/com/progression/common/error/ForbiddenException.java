package com.progression.common.error;

/**
 * Thrown when the caller may know a resource exists but isn't allowed to see
 * it, e.g. a friend who shares PRs only. Mapped to HTTP 403.
 */
public class ForbiddenException extends RuntimeException {

	public ForbiddenException(String message) {
		super(message);
	}
}
