package com.progression.common.error;

/**
 * Thrown when a request conflicts with the current state of a resource, for
 * example saving a workout that is older than the server's copy, or creating
 * an exercise whose name is already taken. Mapped to HTTP 409.
 */
public class ConflictException extends RuntimeException {

	public ConflictException(String message) {
		super(message);
	}
}
