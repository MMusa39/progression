package com.progression.exercise;

import static org.assertj.core.api.Assertions.assertThat;

import com.progression.IntegrationTest;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;

class ExerciseApiTest extends IntegrationTest {

	@Test
	void listIncludesSeededCatalog() {
		assertThat(mvc.get().uri("/api/v1/exercises").with(as(newUser())))
				.hasStatusOk()
				.bodyJson().extractingPath("$[*].name").asArray()
				.contains("Bench Press", "Back Squat", "Deadlift")
				.hasSizeGreaterThan(50);
	}

	@Test
	void searchIsCaseInsensitiveSubstringMatch() {
		assertThat(mvc.get().uri("/api/v1/exercises?query=BENCH").with(as(newUser())))
				.hasStatusOk()
				.bodyJson().extractingPath("$[*].name").asArray()
				.contains("Bench Press", "Incline Bench Press", "Close-Grip Bench Press")
				.allSatisfy(name -> assertThat((String) name).containsIgnoringCase("bench"));
	}

	@Test
	void searchTreatsLikeWildcardsLiterally() {
		assertThat(mvc.get().uri("/api/v1/exercises?query=%25").with(as(newUser())))
				.hasStatusOk()
				.bodyJson().extractingPath("$").asArray().isEmpty();
	}

	@Test
	void createsCustomExerciseVisibleOnlyToItsOwner() {
		String owner = newUser();
		assertThat(mvc.post().uri("/api/v1/exercises").with(as(owner))
				.contentType(MediaType.APPLICATION_JSON)
				.content("""
						{"name": "Zercher Squat", "muscleGroup": "QUADS", "equipment": "BARBELL"}
						"""))
				.hasStatus(HttpStatus.CREATED)
				.bodyJson().extractingPath("$.custom").isEqualTo(true);

		assertThat(mvc.get().uri("/api/v1/exercises?query=zercher").with(as(owner)))
				.bodyJson().extractingPath("$").asArray().hasSize(1);
		assertThat(mvc.get().uri("/api/v1/exercises?query=zercher").with(as(newUser())))
				.bodyJson().extractingPath("$").asArray().isEmpty();
	}

	@Test
	void rejectsCustomExerciseThatDuplicatesACatalogName() {
		assertThat(mvc.post().uri("/api/v1/exercises").with(as(newUser()))
				.contentType(MediaType.APPLICATION_JSON)
				.content("""
						{"name": "bench press", "muscleGroup": "CHEST", "equipment": "BARBELL"}
						"""))
				.hasStatus(HttpStatus.CONFLICT);
	}

	@Test
	void rejectsInvalidCustomExercise() {
		assertThat(mvc.post().uri("/api/v1/exercises").with(as(newUser()))
				.contentType(MediaType.APPLICATION_JSON)
				.content("""
						{"name": " ", "muscleGroup": "CHEST"}
						"""))
				.hasStatus(HttpStatus.BAD_REQUEST)
				.bodyJson().extractingPath("$.errors[*].field").asArray()
				.containsExactlyInAnyOrder("name", "equipment");
	}
}
