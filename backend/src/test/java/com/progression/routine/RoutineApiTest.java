package com.progression.routine;

import static org.assertj.core.api.Assertions.assertThat;

import java.util.UUID;

import com.progression.IntegrationTest;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import tools.jackson.databind.JsonNode;

class RoutineApiTest extends IntegrationTest {

	private String user;
	private String bench;
	private String squat;

	@BeforeEach
	void setUp() throws Exception {
		user = newUser();
		bench = exerciseId("Bench Press");
		squat = exerciseId("Back Squat");
	}

	@Test
	void createListUpdateAndDelete() throws Exception {
		UUID id = UUID.randomUUID();
		JsonNode saved = put(id, routine("Upper A", bench, 3, 6, 8));
		assertThat(saved.get("exercises").get(0).get("exerciseName").asString()).isEqualTo("Bench Press");
		assertThat(saved.get("exercises").get(0).get("equipment").asString()).isEqualTo("BARBELL");

		put(id, "{\"name\": \"Upper A\", \"exercises\": [" + exercise(squat, 5, 5, 5) + "," + exercise(bench, 3, 8, 12) + "]}");
		JsonNode list = json.readTree(mvc.get().uri("/api/v1/routines").with(as(user)).exchange().getResponse().getContentAsString());
		assertThat(list).hasSize(1);
		assertThat(list.get(0).get("exercises").get(1).get("repMax").asInt()).isEqualTo(12);

		assertThat(mvc.delete().uri("/api/v1/routines/{id}", id).with(as(user))).hasStatus(HttpStatus.NO_CONTENT);
		assertThat(mvc.get().uri("/api/v1/routines/{id}", id).with(as(user))).hasStatus(HttpStatus.NOT_FOUND);
	}

	@Test
	void othersCantReadOrOverwriteARoutine() throws Exception {
		UUID id = UUID.randomUUID();
		put(id, routine("Mine", bench, 3, 5, 5));
		String stranger = newUser();
		assertThat(mvc.get().uri("/api/v1/routines/{id}", id).with(as(stranger))).hasStatus(HttpStatus.NOT_FOUND);
		assertThat(mvc.put().uri("/api/v1/routines/{id}", id).with(as(stranger)).contentType(MediaType.APPLICATION_JSON)
				.content(routine("Hijack", bench, 1, 1, 1))).hasStatus(HttpStatus.NOT_FOUND);
	}

	@Test
	void rejectsBadRangesAndUnknownExercises() {
		assertThat(mvc.put().uri("/api/v1/routines/{id}", UUID.randomUUID()).with(as(user)).contentType(MediaType.APPLICATION_JSON)
				.content(routine("Bad", bench, 3, 10, 8))).hasStatus(HttpStatus.BAD_REQUEST);
		assertThat(mvc.put().uri("/api/v1/routines/{id}", UUID.randomUUID()).with(as(user)).contentType(MediaType.APPLICATION_JSON)
				.content(routine("Bad", UUID.randomUUID().toString(), 3, 5, 8))).hasStatus(HttpStatus.BAD_REQUEST);
	}

	private String routine(String name, String exerciseId, int sets, int repMin, int repMax) {
		return "{\"name\": \"" + name + "\", \"exercises\": [" + exercise(exerciseId, sets, repMin, repMax) + "]}";
	}

	private String exercise(String exerciseId, int sets, int repMin, int repMax) {
		return "{\"exerciseId\": \"%s\", \"sets\": %d, \"repMin\": %d, \"repMax\": %d}".formatted(exerciseId, sets, repMin, repMax);
	}

	private JsonNode put(UUID id, String body) throws Exception {
		var result = mvc.put().uri("/api/v1/routines/{id}", id).with(as(user)).contentType(MediaType.APPLICATION_JSON).content(body).exchange();
		assertThat(result).hasStatusOk();
		return json.readTree(result.getResponse().getContentAsString());
	}

	private String exerciseId(String name) throws Exception {
		JsonNode exercises = json.readTree(mvc.get().uri("/api/v1/exercises?query={q}", name).with(as(user))
				.exchange().getResponse().getContentAsString());
		for (JsonNode e : exercises) {
			if (e.get("name").asString().equals(name)) {
				return e.get("id").asString();
			}
		}
		throw new IllegalStateException(name);
	}
}
