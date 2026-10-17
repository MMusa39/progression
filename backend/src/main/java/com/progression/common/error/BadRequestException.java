package com.progression.common.error;

/**
 * Thrown for requests that are well-formed JSON and pass bean validation but
 * break a business rule (e.g. referencing an exercise that doesn't exist).
 * Mapped to HTTP 400.
 */
public class BadRequestException extends RuntimeException {

	public BadRequestException(String message) {
		super(message);
	}
}
