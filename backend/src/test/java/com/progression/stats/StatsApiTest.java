package com.progression.stats;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.within;

import java.math.BigDecimal;
import java.time.DayOfWeek;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneOffset;
import java.time.temporal.ChronoUnit;
import java.time.temporal.TemporalAdjusters;
import java.util.List;
import java.util.UUID;

import com.progression.IntegrationTest;
import com.progression.common.WeightUnit;
import com.progression.workout.SetType;
import com.progression.workout.WorkoutRequest;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import tools.jackson.databind.JsonNode;

/**
 * Exercises the analytics SQL (working_set view, e1RM function, bucketing,
 * PR comparison) against real PostgreSQL. Workouts are placed relative to now,
 * because ranges and streaks are relative to the current date.
 */
class StatsApiTest extends IntegrationTest {

	private static final Instant NOW = Instant.now();

	private String user;
	private UUID bench;
	private UUID squat;

	@BeforeEach
	void setUp() throws Exception {
		user = newUser();
		bench = catalogExerciseId("Bench Press");
		squat = catalogExerciseId("Back Squat");
	}

	// ---------------------------------------------------------------- progression

	@Test
	void progressionHasOnePointPerSessionWithEstimatedOneRepMax() throws Exception {
		log(daysAgo(14), entry(bench, warmup(60, 10), kg(100, 5), kg(100, 4)));
		log(daysAgo(7), entry(bench, kg(105, 5)), entry(squat, kg(140, 5)));
		log(daysAgo(1), entry(bench, kg(110, 1)));

		JsonNode body = getJson("/api/v1/stats/exercises/" + bench + "/progression");
		JsonNode points = body.get("points");

		assertThat(body.get("exerciseName").asString()).isEqualTo("Bench Press");
		assertThat(points).hasSize(3);
		// Epley: 100 × (1 + 5/30) = 116.67; warm-up ignored.
		assertThat(points.get(0).get("bestE1rmKg").asDouble()).isCloseTo(116.67, within(0.01));
		assertThat(points.get(0).get("topSetWeightKg").asDouble()).isEqualTo(100.0);
		assertThat(points.get(0).get("topSetReps").asInt()).isEqualTo(5);
		assertThat(points.get(0).get("volumeKg").asDouble()).isEqualTo(900.0);
		assertThat(points.get(0).get("setCount").asInt()).isEqualTo(2);
		// A single rep is already a 1RM.
		assertThat(points.get(2).get("bestE1rmKg").asDouble()).isEqualTo(110.0);
	}

	@Test
	void progressionRespectsTheFromBoundAndConvertsPounds() throws Exception {
		log(daysAgo(60), entry(bench, kg(80, 5)));
		log(daysAgo(3), entry(bench, lb(225, 1)));

		JsonNode points = getJson("/api/v1/stats/exercises/" + bench + "/progression?from=" + daysAgo(30)).get("points");

		assertThat(points).hasSize(1);
		assertThat(points.get(0).get("topSetWeightKg").asDouble()).isCloseTo(102.06, within(0.01));
	}

	@Test
	void progressionForAnUnknownExerciseIsNotFound() {
		assertThat(mvc.get().uri("/api/v1/stats/exercises/{id}/progression", UUID.randomUUID()).with(as(user)))
				.hasStatus(HttpStatus.NOT_FOUND);
	}

	// ---------------------------------------------------------------- personal records

	@Test
	void firstSessionOfAnExerciseSetsNoRecords() throws Exception {
		UUID first = log(daysAgo(7), entry(bench, kg(100, 5)));

		assertThat(getJson("/api/v1/workouts/" + first + "/records")).isEmpty();
	}

	@Test
	void beatingEarlierWorkoutsSetsRecords() throws Exception {
		log(daysAgo(14), entry(bench, kg(100, 5), kg(100, 5)));
		WorkoutRequest.SetEntry heavySingle = kg(110, 1);
		UUID latest = log(daysAgo(7), entry(bench, kg(100, 8), heavySingle, kg(100, 5))); // volume 1,410 > 1,000

		JsonNode records = getJson("/api/v1/workouts/" + latest + "/records");

		assertThat(records).extracting(r -> r.get("type").asString())
				.containsExactlyInAnyOrder("ESTIMATED_1RM", "HEAVIEST_WEIGHT", "SESSION_VOLUME");
		JsonNode heaviest = find(records, "HEAVIEST_WEIGHT");
		assertThat(heaviest.get("setId").asString()).isEqualTo(heavySingle.id().toString());
		assertThat(heaviest.get("valueKg").asDouble()).isEqualTo(110.0);
		assertThat(heaviest.get("previousKg").asDouble()).isEqualTo(100.0);
		// 100 × (1 + 8/30) = 126.67 beats 116.67
		assertThat(find(records, "ESTIMATED_1RM").get("valueKg").asDouble()).isCloseTo(126.67, within(0.01));
	}

	@Test
	void matchingAPreviousBestIsNotARecord() throws Exception {
		log(daysAgo(14), entry(bench, kg(100, 5)));
		UUID same = log(daysAgo(7), entry(bench, kg(100, 5)));

		assertThat(getJson("/api/v1/workouts/" + same + "/records")).isEmpty();
	}

	@Test
	void recordsOnlyCompareAgainstEarlierWorkouts() throws Exception {
		UUID older = log(daysAgo(14), entry(bench, kg(100, 5)));
		log(daysAgo(7), entry(bench, kg(120, 5))); // a later, better workout

		// The older workout is judged against what came before it (nothing), not after it.
		assertThat(getJson("/api/v1/workouts/" + older + "/records")).isEmpty();
	}

	@Test
	void recordsOfAnotherUsersWorkoutAreNotFound() throws Exception {
		UUID workout = log(daysAgo(1), entry(bench, kg(100, 5)));
		assertThat(mvc.get().uri("/api/v1/workouts/{id}/records", workout).with(as(newUser())))
				.hasStatus(HttpStatus.NOT_FOUND);
	}

	// ---------------------------------------------------------------- summary

	@Test
	void summaryTotalsBucketsAndMuscleGroups() throws Exception {
		log(daysAgo(20), entry(bench, kg(100, 5)));
		log(daysAgo(10), entry(bench, kg(100, 5), kg(100, 5)), entry(squat, kg(140, 5)));
		log(daysAgo(45), entry(squat, kg(120, 5))); // previous period

		JsonNode summary = getJson("/api/v1/stats/summary?tz=UTC&from=" + daysAgo(28));

		assertThat(summary.get("bucket").asString()).isEqualTo("WEEK");
		assertThat(summary.get("totals").get("workouts").asInt()).isEqualTo(2);
		assertThat(summary.get("totals").get("sets").asInt()).isEqualTo(4);
		assertThat(summary.get("totals").get("volumeKg").asDouble()).isEqualTo(2200.0);
		assertThat(summary.get("previousTotals").get("workouts").asInt()).isEqualTo(1);

		JsonNode buckets = summary.get("buckets");
		assertThat(buckets.size()).isBetween(5, 6); // every week in the range, including empty ones
		int bucketWorkouts = 0;
		for (JsonNode bucket : buckets) {
			bucketWorkouts += bucket.get("workouts").asInt();
			assertThat(LocalDate.parse(bucket.get("start").asString()).getDayOfWeek()).isEqualTo(DayOfWeek.MONDAY);
		}
		assertThat(bucketWorkouts).isEqualTo(2);

		assertThat(summary.get("muscleGroups").get(0).get("muscleGroup").asString()).isEqualTo("CHEST");
		assertThat(summary.get("muscleGroups").get(0).get("sets").asInt()).isEqualTo(3);
	}

	@Test
	void weeksFollowTheUsersTimeZone() throws Exception {
		// 03:00 UTC on a Monday is still Sunday evening in New York.
		LocalDate monday = LocalDate.now(ZoneOffset.UTC).with(TemporalAdjusters.previousOrSame(DayOfWeek.MONDAY)).minusWeeks(1);
		Instant mondayEarlyUtc = monday.atTime(3, 0).toInstant(ZoneOffset.UTC);
		log(mondayEarlyUtc, entry(bench, kg(100, 5)));
		String from = mondayEarlyUtc.minus(20, ChronoUnit.DAYS).toString();

		assertThat(weekWithWorkout("/api/v1/stats/summary?tz=UTC&from=" + from)).isEqualTo(monday);
		assertThat(weekWithWorkout("/api/v1/stats/summary?tz=America/New_York&from=" + from)).isEqualTo(monday.minusWeeks(1));
	}

	@Test
	void allTimeSummaryHasNoPreviousPeriod() throws Exception {
		log(daysAgo(400), entry(bench, kg(80, 5)));
		log(daysAgo(2), entry(bench, kg(100, 5)));

		JsonNode summary = getJson("/api/v1/stats/summary?tz=UTC");

		assertThat(summary.get("from").isNull()).isTrue();
		assertThat(summary.get("previousTotals").isNull()).isTrue();
		assertThat(summary.get("bucket").asString()).isEqualTo("MONTH");
		assertThat(summary.get("totals").get("workouts").asInt()).isEqualTo(2);
	}

	@Test
	void summaryForANewUserIsEmptyButValid() throws Exception {
		JsonNode summary = getJson("/api/v1/stats/summary?tz=UTC");

		assertThat(summary.get("totals").get("workouts").asInt()).isZero();
		assertThat(summary.get("currentStreakWeeks").asInt()).isZero();
		assertThat(summary.get("buckets")).hasSize(1);
	}

	@Test
	void rejectsUnknownTimeZoneAndFutureFrom() {
		assertThat(mvc.get().uri("/api/v1/stats/summary?tz=Mars/Olympus").with(as(user))).hasStatus(HttpStatus.BAD_REQUEST);
		assertThat(mvc.get().uri("/api/v1/stats/summary?from=" + NOW.plus(2, ChronoUnit.DAYS)).with(as(user)))
				.hasStatus(HttpStatus.BAD_REQUEST);
	}

	// ---------------------------------------------------------------- exercise stats

	@Test
	void exerciseStatsListRecordsAndRecentTrend() throws Exception {
		log(daysAgo(21), entry(bench, kg(100, 5)));
		log(daysAgo(14), entry(bench, kg(105, 5)), entry(squat, kg(140, 3)));
		log(daysAgo(7), entry(bench, kg(102.5, 5)));

		JsonNode list = getJson("/api/v1/stats/exercises");

		assertThat(list).hasSize(2);
		JsonNode benchStats = list.get(0); // most recently performed first
		assertThat(benchStats.get("exerciseName").asString()).isEqualTo("Bench Press");
		assertThat(benchStats.get("sessions").asInt()).isEqualTo(3);
		assertThat(benchStats.get("heaviestWeightKg").asDouble()).isEqualTo(105.0);
		assertThat(benchStats.get("bestE1rmKg").asDouble()).isCloseTo(122.5, within(0.01));
		assertThat(benchStats.get("recentBestE1rmKg")).extracting(JsonNode::asDouble)
				.containsExactly(116.67, 122.5, 119.58); // oldest → newest
	}

	// ---------------------------------------------------------------- helpers

	private LocalDate weekWithWorkout(String uri) throws Exception {
		for (JsonNode bucket : getJson(uri).get("buckets")) {
			if (bucket.get("workouts").asInt() > 0) {
				return LocalDate.parse(bucket.get("start").asString());
			}
		}
		throw new AssertionError("No bucket contains the workout");
	}

	private static JsonNode find(JsonNode records, String type) {
		for (JsonNode record : records) {
			if (record.get("type").asString().equals(type)) {
				return record;
			}
		}
		throw new AssertionError("No " + type + " record");
	}

	private JsonNode getJson(String uri) throws Exception {
		var result = mvc.get().uri(uri).with(as(user)).exchange();
		assertThat(result).hasStatusOk();
		return json.readTree(result.getResponse().getContentAsString());
	}

	private UUID log(Instant startedAt, WorkoutRequest.ExerciseEntry... exercises) {
		UUID id = UUID.randomUUID();
		WorkoutRequest request = new WorkoutRequest("Workout", startedAt, startedAt.plus(1, ChronoUnit.HOURS), null,
				startedAt.plus(1, ChronoUnit.HOURS), List.of(exercises));
		assertThat(mvc.put().uri("/api/v1/workouts/{id}", id).with(as(user))
				.contentType(MediaType.APPLICATION_JSON).content(toJson(request)))
				.hasStatus(HttpStatus.CREATED);
		return id;
	}

	private static Instant daysAgo(int days) {
		return NOW.minus(days, ChronoUnit.DAYS).truncatedTo(ChronoUnit.SECONDS);
	}

	private static WorkoutRequest.ExerciseEntry entry(UUID exerciseId, WorkoutRequest.SetEntry... sets) {
		return new WorkoutRequest.ExerciseEntry(UUID.randomUUID(), exerciseId, null, List.of(sets));
	}

	private static WorkoutRequest.SetEntry kg(double weight, int reps) {
		return set(SetType.WORKING, weight, WeightUnit.KG, reps);
	}

	private static WorkoutRequest.SetEntry lb(double weight, int reps) {
		return set(SetType.WORKING, weight, WeightUnit.LB, reps);
	}

	private static WorkoutRequest.SetEntry warmup(double weight, int reps) {
		return set(SetType.WARMUP, weight, WeightUnit.KG, reps);
	}

	private static WorkoutRequest.SetEntry set(SetType type, double weight, WeightUnit unit, int reps) {
		return new WorkoutRequest.SetEntry(UUID.randomUUID(), type, BigDecimal.valueOf(weight), unit, reps, null, NOW);
	}

	private UUID catalogExerciseId(String name) throws Exception {
		var result = mvc.get().uri("/api/v1/exercises?query={q}", name).with(as(user)).exchange();
		for (JsonNode exercise : json.readTree(result.getResponse().getContentAsString())) {
			if (exercise.get("name").asString().equals(name)) {
				return UUID.fromString(exercise.get("id").asString());
			}
		}
		throw new IllegalStateException("Catalog exercise not found: " + name);
	}
}
