package com.progression.workout;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import java.time.Instant;
import java.util.UUID;

import com.progression.common.error.BadRequestException;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;

class WorkoutCursorTest {

	@Test
	void roundTripsThroughItsEncodedForm() {
		WorkoutCursor cursor = new WorkoutCursor(Instant.parse("2026-10-16T18:30:00.123456Z"), UUID.randomUUID());

		assertThat(WorkoutCursor.decode(cursor.encode())).isEqualTo(cursor);
	}

	@Test
	void encodedFormIsUrlSafe() {
		String encoded = new WorkoutCursor(Instant.now(), UUID.randomUUID()).encode();

		assertThat(encoded).matches("[A-Za-z0-9_-]+");
	}

	@ParameterizedTest
	@ValueSource(strings = { "", "not-base64!", "bm8tc2VwYXJhdG9y" /* "no-separator" */ })
	void rejectsMalformedCursors(String encoded) {
		assertThatThrownBy(() -> WorkoutCursor.decode(encoded)).isInstanceOf(BadRequestException.class);
	}
}
