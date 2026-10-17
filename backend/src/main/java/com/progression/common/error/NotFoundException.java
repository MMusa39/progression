package com.progression.common.error;

/**
 * Thrown when a requested resource does not exist <em>or is not visible to the
 * current user</em>. The two cases are deliberately indistinguishable, so the
 * API never reveals that another user's resource exists. Mapped to HTTP 404.
 */
public class NotFoundException extends RuntimeException {

	public NotFoundException(String message) {
		super(message);
	}
}
