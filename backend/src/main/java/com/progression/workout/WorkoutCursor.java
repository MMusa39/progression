package com.progression.workout;

import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.util.Base64;
import java.util.UUID;

import com.progression.common.error.BadRequestException;

/**
 * Position in a user's workout history: the sort key ({@code startedAt},
 * {@code id}) of the last workout on the previous page.
 *
 * <p>Clients treat the encoded value as an opaque string, which leaves the
 * server free to change the format later without breaking them.
 */
record WorkoutCursor(Instant startedAt, UUID id) {

	private static final Base64.Encoder ENCODER = Base64.getUrlEncoder().withoutPadding();
	private static final Base64.Decoder DECODER = Base64.getUrlDecoder();

	static WorkoutCursor of(Workout workout) {
		return new WorkoutCursor(workout.getStartedAt(), workout.getId());
	}

	String encode() {
		String raw = startedAt + "|" + id;
		return ENCODER.encodeToString(raw.getBytes(StandardCharsets.UTF_8));
	}

	static WorkoutCursor decode(String encoded) {
		try {
			String raw = new String(DECODER.decode(encoded), StandardCharsets.UTF_8);
			int separator = raw.indexOf('|');
			return new WorkoutCursor(Instant.parse(raw.substring(0, separator)),
					UUID.fromString(raw.substring(separator + 1)));
		}
		catch (RuntimeException ex) {
			throw new BadRequestException("Invalid cursor");
		}
	}
}
