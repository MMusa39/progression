package com.progression.workout;

import static org.assertj.core.api.Assertions.assertThat;

import java.math.BigDecimal;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

import com.progression.IntegrationTest;
import com.progression.common.WeightUnit;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.assertj.MvcTestResult;
import tools.jackson.databind.JsonNode;

class WorkoutApiTest extends IntegrationTest {

	private static final Instant MONDAY = Instant.parse("2026-10-12T18:00:00Z");

	private String user;
	private UUID benchPress;
	private UUID backSquat;

	@BeforeEach
	void setUp() throws Exception {
		user = newUser();
		benchPress = catalogExerciseId("Bench Press");
		backSquat = catalogExerciseId("Back Squat");
	}

	// ---------------------------------------------------------------- create / read

	@Test
	void putCreatesWorkoutAndReturnsItInOrder() {
		UUID id = UUID.randomUUID();
		WorkoutRequest request = workout(MONDAY,
				exercise(benchPress, warmup(135, 10), set(185, 8), set(185, 7)),
				exercise(backSquat, set(225, 5)));

		assertThat(put(id, request))
				.hasStatus(HttpStatus.CREATED)
				.bodyJson()
				.satisfies(body -> {
					assertThat(body).extractingPath("$.exercises[*].exerciseName").asArray()
							.containsExactly("Bench Press", "Back Squat");
					assertThat(body).extractingPath("$.exercises[0].sets[*].reps").asArray()
							.containsExactly(10, 8, 7);
					assertThat(body).extractingPath("$.exercises[0].sets[0].setType").isEqualTo("WARMUP");
				});

		assertThat(mvc.get().uri("/api/v1/workouts/{id}", id).with(as(user)))
				.hasStatusOk()
				.bodyJson().extractingPath("$.exercises[1].sets[0].weight").isEqualTo(225.0);
	}

	@Test
	void repeatingTheSamePutIsIdempotent() throws Exception {
		UUID id = UUID.randomUUID();
		WorkoutRequest request = workout(MONDAY, exercise(benchPress, set(185, 8)));

		MvcTestResult first = put(id, request).exchange();
		MvcTestResult second = put(id, request).exchange();

		assertThat(first).hasStatus(HttpStatus.CREATED);
		assertThat(second).hasStatus(HttpStatus.OK);
		assertThat(json.readTree(second.getResponse().getContentAsString()))
				.isEqualTo(json.readTree(first.getResponse().getContentAsString()));
	}

	@Test
	void putReplacesExercisesAndSets() {
		UUID id = UUID.randomUUID();
		WorkoutRequest.SetEntry keptSet = set(185, 8);
		WorkoutRequest.ExerciseEntry bench = exercise(benchPress, keptSet, set(185, 7));
		put(id, workout(MONDAY, bench, exercise(backSquat, set(225, 5)))).exchange();

		// Second version: squat removed, second bench set removed, kept set edited, new set added.
		WorkoutRequest.SetEntry editedSet = new WorkoutRequest.SetEntry(keptSet.id(), SetType.WORKING,
				new BigDecimal("190"), WeightUnit.LB, 6, null, MONDAY);
		WorkoutRequest updated = new WorkoutRequest("Push Day", MONDAY, null, null, MONDAY.plusSeconds(60),
				List.of(new WorkoutRequest.ExerciseEntry(bench.id(), benchPress, "Paused reps",
						List.of(editedSet, set(170, 10)))));

		assertThat(put(id, updated))
				.hasStatusOk()
				.bodyJson()
				.satisfies(body -> {
					assertThat(body).extractingPath("$.exercises").asArray().hasSize(1);
					assertThat(body).extractingPath("$.exercises[0].notes").isEqualTo("Paused reps");
					assertThat(body).extractingPath("$.exercises[0].sets[*].reps").asArray().containsExactly(6, 10);
					assertThat(body).extractingPath("$.exercises[0].sets[0].id").isEqualTo(keptSet.id().toString());
				});
	}

	// ---------------------------------------------------------------- conflicts & validation

	@Test
	void staleWriteIsRejectedWithConflict() {
		UUID id = UUID.randomUUID();
		put(id, workout(MONDAY.plusSeconds(3600), exercise(benchPress, set(185, 8)))).exchange();

		WorkoutRequest stale = workout(MONDAY, exercise(benchPress, set(135, 1)));
		assertThat(put(id, stale)).hasStatus(HttpStatus.CONFLICT);
	}

	@Test
	void unknownExerciseIsRejected() {
		WorkoutRequest request = workout(MONDAY, exercise(UUID.randomUUID(), set(100, 5)));
		assertThat(put(UUID.randomUUID(), request))
				.hasStatus(HttpStatus.BAD_REQUEST)
				.bodyJson().extractingPath("$.detail").asString().startsWith("Unknown exercise");
	}

	@Test
	void invalidSetIsRejectedWithFieldErrors() {
		WorkoutRequest.SetEntry negativeReps = new WorkoutRequest.SetEntry(UUID.randomUUID(), SetType.WORKING,
				new BigDecimal("100"), WeightUnit.LB, -1, null, MONDAY);
		WorkoutRequest request = workout(MONDAY, exercise(benchPress, negativeReps));

		assertThat(put(UUID.randomUUID(), request))
				.hasStatus(HttpStatus.BAD_REQUEST)
				.bodyJson().extractingPath("$.errors[0].field").isEqualTo("exercises[0].sets[0].reps");
	}

	@Test
	void duplicateIdsInRequestAreRejected() {
		WorkoutRequest.SetEntry set = set(100, 5);
		WorkoutRequest request = workout(MONDAY, exercise(benchPress, set, set));
		assertThat(put(UUID.randomUUID(), request)).hasStatus(HttpStatus.BAD_REQUEST);
	}

	// ---------------------------------------------------------------- authorization

	@Test
	void usersCannotReadOrOverwriteEachOthersWorkouts() {
		UUID id = UUID.randomUUID();
		WorkoutRequest request = workout(MONDAY, exercise(benchPress, set(185, 8)));
		put(id, request).exchange();

		String intruder = newUser();
		assertThat(mvc.get().uri("/api/v1/workouts/{id}", id).with(as(intruder))).hasStatus(HttpStatus.NOT_FOUND);
		assertThat(mvc.put().uri("/api/v1/workouts/{id}", id).with(as(intruder))
				.contentType(MediaType.APPLICATION_JSON).content(toJson(request)))
				.hasStatus(HttpStatus.NOT_FOUND);

		// The intruder's delete is a silent no-op; the owner's workout survives.
		assertThat(mvc.delete().uri("/api/v1/workouts/{id}", id).with(as(intruder))).hasStatus(HttpStatus.NO_CONTENT);
		assertThat(mvc.get().uri("/api/v1/workouts/{id}", id).with(as(user))).hasStatusOk();
	}

	// ---------------------------------------------------------------- delete

	@Test
	void deleteIsIdempotent() {
		UUID id = UUID.randomUUID();
		put(id, workout(MONDAY, exercise(benchPress, set(185, 8)))).exchange();

		assertThat(mvc.delete().uri("/api/v1/workouts/{id}", id).with(as(user))).hasStatus(HttpStatus.NO_CONTENT);
		assertThat(mvc.get().uri("/api/v1/workouts/{id}", id).with(as(user))).hasStatus(HttpStatus.NOT_FOUND);
		assertThat(mvc.delete().uri("/api/v1/workouts/{id}", id).with(as(user))).hasStatus(HttpStatus.NO_CONTENT);
	}

	// ---------------------------------------------------------------- history

	@Test
	void historyIsPaginatedNewestFirst() throws Exception {
		List<UUID> ids = new ArrayList<>();
		for (int day = 0; day < 5; day++) {
			UUID id = UUID.randomUUID();
			ids.add(id);
			put(id, workout(MONDAY.plus(day, ChronoUnit.DAYS), exercise(benchPress, set(185, 8)))).exchange();
		}
		List<String> expectedOrder = ids.reversed().stream().map(UUID::toString).toList();

		List<String> seen = new ArrayList<>();
		String cursor = null;
		int pages = 0;
		do {
			String uri = "/api/v1/workouts?limit=2" + (cursor == null ? "" : "&cursor=" + cursor);
			JsonNode page = json.readTree(
					mvc.get().uri(uri).with(as(user)).exchange().getResponse().getContentAsString());
			page.get("items").forEach(item -> seen.add(item.get("id").asString()));
			cursor = page.get("nextCursor").isNull() ? null : page.get("nextCursor").asString();
			pages++;
		}
		while (cursor != null);

		assertThat(pages).isEqualTo(3);
		assertThat(seen).containsExactlyElementsOf(expectedOrder);
	}

	@Test
	void historySummaryCountsOnlyCompletedWorkingSets() {
		WorkoutRequest.SetEntry notDoneYet = new WorkoutRequest.SetEntry(UUID.randomUUID(), SetType.WORKING,
				new BigDecimal("100"), WeightUnit.KG, 5, null, null);
		put(UUID.randomUUID(), workout(MONDAY, exercise(benchPress,
				new WorkoutRequest.SetEntry(UUID.randomUUID(), SetType.WARMUP, new BigDecimal("60"), WeightUnit.KG, 10, null, MONDAY),
				new WorkoutRequest.SetEntry(UUID.randomUUID(), SetType.WORKING, new BigDecimal("100"), WeightUnit.KG, 5, null, MONDAY),
				new WorkoutRequest.SetEntry(UUID.randomUUID(), SetType.WORKING, new BigDecimal("100"), WeightUnit.KG, 4, null, MONDAY),
				notDoneYet))).exchange();

		assertThat(mvc.get().uri("/api/v1/workouts").with(as(user)))
				.hasStatusOk()
				.bodyJson()
				.satisfies(body -> {
					assertThat(body).extractingPath("$.items[0].setCount").isEqualTo(2);
					assertThat(body).extractingPath("$.items[0].totalVolumeKg").isEqualTo(900.0);
					assertThat(body).extractingPath("$.items[0].exerciseNames").asArray().containsExactly("Bench Press");
					assertThat(body).extractingPath("$.nextCursor").isNull();
				});
	}

	@Test
	void invalidCursorIsRejected() {
		assertThat(mvc.get().uri("/api/v1/workouts?cursor=garbage").with(as(user))).hasStatus(HttpStatus.BAD_REQUEST);
	}

	// ---------------------------------------------------------------- last performance

	@Test
	void lastPerformanceReturnsMostRecentOtherWorkout() {
		UUID older = UUID.randomUUID();
		UUID newer = UUID.randomUUID();
		put(older, workout(MONDAY, exercise(benchPress, set(175, 8)))).exchange();
		put(newer, workout(MONDAY.plus(2, ChronoUnit.DAYS), exercise(benchPress, set(185, 8), set(185, 7)))).exchange();

		assertThat(mvc.get().uri("/api/v1/exercises/{id}/last-performance", benchPress).with(as(user)))
				.hasStatusOk()
				.bodyJson()
				.satisfies(body -> {
					assertThat(body).extractingPath("$.workoutId").isEqualTo(newer.toString());
					assertThat(body).extractingPath("$.sets[*].reps").asArray().containsExactly(8, 7);
				});

		// While logging `newer`, the hint should show the session before it.
		assertThat(mvc.get().uri("/api/v1/exercises/{id}/last-performance?excludeWorkoutId={w}", benchPress, newer)
				.with(as(user)))
				.hasStatusOk()
				.bodyJson().extractingPath("$.workoutId").isEqualTo(older.toString());
	}

	@Test
	void lastPerformanceIsEmptyForANeverPerformedExercise() {
		assertThat(mvc.get().uri("/api/v1/exercises/{id}/last-performance", backSquat).with(as(user)))
				.hasStatus(HttpStatus.NO_CONTENT);
	}

	// ---------------------------------------------------------------- helpers

	private org.springframework.test.web.servlet.assertj.MockMvcTester.MockMvcRequestBuilder put(UUID id,
			WorkoutRequest request) {
		return mvc.put().uri("/api/v1/workouts/{id}", id).with(as(user))
				.contentType(MediaType.APPLICATION_JSON)
				.content(toJson(request));
	}

	private UUID catalogExerciseId(String name) throws Exception {
		String body = mvc.get().uri("/api/v1/exercises?query={q}", name).with(as(user))
				.exchange().getResponse().getContentAsString();
		for (JsonNode exercise : json.readTree(body)) {
			if (exercise.get("name").asString().equals(name)) {
				return UUID.fromString(exercise.get("id").asString());
			}
		}
		throw new IllegalStateException("Catalog exercise not found: " + name);
	}

	private static WorkoutRequest workout(Instant startedAt, WorkoutRequest.ExerciseEntry... exercises) {
		return new WorkoutRequest("Push Day", startedAt, startedAt.plus(1, ChronoUnit.HOURS), null, startedAt,
				List.of(exercises));
	}

	private static WorkoutRequest.ExerciseEntry exercise(UUID exerciseId, WorkoutRequest.SetEntry... sets) {
		return new WorkoutRequest.ExerciseEntry(UUID.randomUUID(), exerciseId, null, List.of(sets));
	}

	private static WorkoutRequest.SetEntry set(int pounds, int reps) {
		return new WorkoutRequest.SetEntry(UUID.randomUUID(), SetType.WORKING, BigDecimal.valueOf(pounds),
				WeightUnit.LB, reps, null, MONDAY);
	}

	private static WorkoutRequest.SetEntry warmup(int pounds, int reps) {
		return new WorkoutRequest.SetEntry(UUID.randomUUID(), SetType.WARMUP, BigDecimal.valueOf(pounds),
				WeightUnit.LB, reps, null, MONDAY);
	}
}
