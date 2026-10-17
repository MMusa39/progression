package com.progression.social;

import static org.assertj.core.api.Assertions.assertThat;

import java.math.BigDecimal;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.List;
import java.util.UUID;

import com.progression.IntegrationTest;
import com.progression.common.WeightUnit;
import com.progression.workout.SetType;
import com.progression.workout.WorkoutRequest;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import tools.jackson.databind.JsonNode;

/**
 * Friends, privacy and leaderboards, end to end against real PostgreSQL.
 * Every test creates its own users with unique usernames.
 */
class FriendApiTest extends IntegrationTest {

	private static final Instant NOW = Instant.now();

	// ---------------------------------------------------------------- usernames

	@Test
	void usernamesAreNormalizedValidatedAndUnique() throws Exception {
		String alice = newUser();
		String name = uniqueName("alice");

		assertThat(patchMe(alice, "{\"username\": \"@" + name.toUpperCase() + "\"}")).hasStatusOk()
				.bodyJson().extractingPath("$.username").isEqualTo(name);
		assertThat(patchMe(newUser(), "{\"username\": \"" + name + "\"}")).hasStatus(HttpStatus.CONFLICT);
		assertThat(patchMe(newUser(), "{\"username\": \"no spaces!\"}")).hasStatus(HttpStatus.BAD_REQUEST);
		assertThat(patchMe(newUser(), "{\"username\": \"ab\"}")).hasStatus(HttpStatus.BAD_REQUEST);
	}

	@Test
	void connectingRequiresAUsername() throws Exception {
		String bob = withUsername("bob");
		String nameless = newUser();
		assertThat(sendRequest(nameless, usernameOf(bob))).hasStatus(HttpStatus.BAD_REQUEST);
	}

	// ---------------------------------------------------------------- requests

	@Test
	void requestThenAcceptMakesMutualFriends() throws Exception {
		String alice = withUsername("alice");
		String bob = withUsername("bob");

		assertThat(sendRequest(alice, usernameOf(bob))).hasStatusOk()
				.bodyJson().extractingPath("$.relationship").isEqualTo("REQUEST_SENT");

		JsonNode bobRequests = get(bob, "/api/v1/friends/requests");
		assertThat(bobRequests.get("incoming")).hasSize(1);
		String requestId = bobRequests.get("incoming").get(0).get("id").asString();

		assertThat(mvc.post().uri("/api/v1/friends/requests/{id}/accept", requestId).with(as(bob)))
				.hasStatusOk().bodyJson().extractingPath("$.relationship").isEqualTo("FRIENDS");

		assertThat(get(alice, "/api/v1/friends")).extracting(f -> f.get("user").get("username").asString())
				.containsExactly(usernameOf(bob));
		assertThat(get(bob, "/api/v1/friends")).extracting(f -> f.get("user").get("username").asString())
				.containsExactly(usernameOf(alice));
	}

	@Test
	void requestingSomeoneWhoAlreadyAskedYouAccepts() throws Exception {
		String alice = withUsername("alice");
		String bob = withUsername("bob");
		sendRequest(alice, usernameOf(bob)).exchange();

		assertThat(sendRequest(bob, usernameOf(alice))).hasStatusOk()
				.bodyJson().extractingPath("$.relationship").isEqualTo("FRIENDS");
	}

	@Test
	void searchShowsRelationship() throws Exception {
		String alice = withUsername("alice");
		String bob = withUsername("bob");
		sendRequest(alice, usernameOf(bob)).exchange();

		JsonNode results = get(alice, "/api/v1/users/search?q=" + usernameOf(bob));
		assertThat(results).hasSize(1);
		assertThat(results.get(0).get("relationship").asString()).isEqualTo("REQUEST_SENT");
		assertThat(get(bob, "/api/v1/users/search?q=" + usernameOf(alice)).get(0).get("relationship").asString())
				.isEqualTo("REQUEST_RECEIVED");
	}

	@Test
	void decliningRemovesTheRequest() throws Exception {
		String alice = withUsername("alice");
		String bob = withUsername("bob");
		sendRequest(alice, usernameOf(bob)).exchange();
		String requestId = get(bob, "/api/v1/friends/requests").get("incoming").get(0).get("id").asString();

		assertThat(mvc.delete().uri("/api/v1/friends/requests/{id}", requestId).with(as(bob))).hasStatus(HttpStatus.NO_CONTENT);
		assertThat(get(alice, "/api/v1/friends/requests").get("outgoing")).isEmpty();
	}

	// ---------------------------------------------------------------- invites

	@Test
	void inviteLinkConnectsImmediatelyAndCanBeRevoked() throws Exception {
		String alice = withUsername("alice");
		String bob = withUsername("bob");
		String code = get(alice, "/api/v1/friends/invite").get("code").asString();

		assertThat(get(bob, "/api/v1/friends/invite/" + code).get("user").get("username").asString()).isEqualTo(usernameOf(alice));
		assertThat(mvc.post().uri("/api/v1/friends/invite/{code}", code).with(as(bob)))
				.hasStatusOk().bodyJson().extractingPath("$.relationship").isEqualTo("FRIENDS");
		assertThat(get(alice, "/api/v1/friends")).hasSize(1);

		String newCode = mvc.post().uri("/api/v1/friends/invite/reset").with(as(alice)).exchange()
				.getResponse().getContentAsString();
		assertThat(newCode).doesNotContain(code);
		assertThat(mvc.get().uri("/api/v1/friends/invite/{code}", code).with(as(withUsername("carol"))))
				.hasStatus(HttpStatus.NOT_FOUND);
	}

	@Test
	void usingYourOwnInviteIsRejected() throws Exception {
		String alice = withUsername("alice");
		String code = get(alice, "/api/v1/friends/invite").get("code").asString();
		assertThat(mvc.post().uri("/api/v1/friends/invite/{code}", code).with(as(alice))).hasStatus(HttpStatus.BAD_REQUEST);
	}

	// ---------------------------------------------------------------- privacy

	@Test
	void strangersSeeNothing() throws Exception {
		String alice = withUsername("alice");
		String stranger = withUsername("stranger");
		log(alice, NOW.minus(1, ChronoUnit.DAYS), "Bench Press", 100, 5);
		UUID aliceId = idOf(alice);

		assertThat(mvc.get().uri("/api/v1/friends/{id}", aliceId).with(as(stranger))).hasStatus(HttpStatus.NOT_FOUND);
		assertThat(mvc.get().uri("/api/v1/friends/{id}/workouts", aliceId).with(as(stranger))).hasStatus(HttpStatus.NOT_FOUND);
		assertThat(mvc.get().uri("/api/v1/friends/{id}/records", aliceId).with(as(stranger))).hasStatus(HttpStatus.NOT_FOUND);
	}

	@Test
	void friendsSeeWorkoutsUnlessSharingIsOff() throws Exception {
		String alice = withUsername("alice");
		String bob = withUsername("bob");
		befriend(alice, bob);
		UUID workout = log(alice, NOW.minus(2, ChronoUnit.DAYS), "Bench Press", 100, 5);
		UUID aliceId = idOf(alice);

		assertThat(get(bob, "/api/v1/friends/" + aliceId + "/workouts").get("items")).hasSize(1);
		assertThat(mvc.get().uri("/api/v1/friends/{id}/workouts/{w}", aliceId, workout).with(as(bob))).hasStatusOk();

		patchMe(alice, "{\"shareWorkouts\": false}").exchange();

		assertThat(mvc.get().uri("/api/v1/friends/{id}/workouts", aliceId).with(as(bob))).hasStatus(HttpStatus.FORBIDDEN);
		assertThat(mvc.get().uri("/api/v1/friends/{id}/workouts/{w}", aliceId, workout).with(as(bob)))
				.hasStatus(HttpStatus.FORBIDDEN);
		// Records stay visible to friends either way.
		assertThat(mvc.get().uri("/api/v1/friends/{id}/records", aliceId).with(as(bob))).hasStatusOk();
		assertThat(get(bob, "/api/v1/friends").get(0).get("shareWorkouts").asBoolean()).isFalse();
	}

	@Test
	void unfriendingRevokesAccess() throws Exception {
		String alice = withUsername("alice");
		String bob = withUsername("bob");
		befriend(alice, bob);
		UUID aliceId = idOf(alice);

		assertThat(mvc.delete().uri("/api/v1/friends/{id}", aliceId).with(as(bob))).hasStatus(HttpStatus.NO_CONTENT);
		assertThat(mvc.get().uri("/api/v1/friends/{id}/records", aliceId).with(as(bob))).hasStatus(HttpStatus.NOT_FOUND);
		assertThat(get(alice, "/api/v1/friends")).isEmpty();
	}

	// ---------------------------------------------------------------- leaderboards

	@Test
	void consistencyBoardRanksByStreakThenWorkoutsAndNamesAWinner() throws Exception {
		String me = withUsername("me");
		String steady = withUsername("steady");
		String idle = withUsername("idle");
		befriend(me, steady);
		befriend(me, idle);
		for (int week = 1; week <= 3; week++) {
			log(steady, NOW.minus(week * 7L, ChronoUnit.DAYS), "Bench Press", 80, 5);
		}
		log(me, NOW.minus(7, ChronoUnit.DAYS), "Bench Press", 100, 5);

		JsonNode entries = get(me, "/api/v1/leaderboards/consistency?tz=UTC").get("entries");

		assertThat(entries).extracting(e -> e.get("user").get("username").asString())
				.containsExactly(usernameOf(steady), usernameOf(me), usernameOf(idle));
		assertThat(entries.get(0).get("winner").asBoolean()).isTrue();
		assertThat(entries.get(1).get("winner").asBoolean()).isFalse();
		assertThat(entries.get(1).get("you").asBoolean()).isTrue();
		assertThat(entries.get(2).get("currentStreakWeeks").asInt()).isZero();
	}

	@Test
	void strengthBoardRanksBestEstimatedOneRepMaxWithoutAWinner() throws Exception {
		String me = withUsername("me");
		String strong = withUsername("strong");
		String stranger = withUsername("stranger");
		befriend(me, strong);
		log(me, NOW.minus(3, ChronoUnit.DAYS), "Bench Press", 100, 5);
		log(strong, NOW.minus(3, ChronoUnit.DAYS), "Bench Press", 140, 3);
		log(stranger, NOW.minus(3, ChronoUnit.DAYS), "Bench Press", 300, 1); // not a friend: excluded

		JsonNode board = get(me, "/api/v1/leaderboards/strength");

		assertThat(board.get("exercise").get("name").asString()).isEqualTo("Bench Press");
		assertThat(board.get("entries")).extracting(e -> e.get("user").get("username").asString())
				.containsExactly(usernameOf(strong), usernameOf(me));
		assertThat(board.get("entries").get(0).get("rank").asInt()).isEqualTo(1);
		assertThat(board.get("entries").get(0).has("winner")).isFalse();
		assertThat(board.get("entries").get(0).get("weight").asDouble()).isEqualTo(140.0);
	}

	// ---------------------------------------------------------------- helpers

	private final java.util.Map<String, String> usernames = new java.util.HashMap<>();

	private static String uniqueName(String base) {
		return (base + "_" + UUID.randomUUID().toString().replace("-", "").substring(0, 8)).toLowerCase();
	}

	/** A fresh user who has picked a unique username. */
	private String withUsername(String base) throws Exception {
		String subject = newUser();
		String name = uniqueName(base);
		assertThat(patchMe(subject, "{\"username\": \"" + name + "\"}")).hasStatusOk();
		usernames.put(subject, name);
		return subject;
	}

	private String usernameOf(String subject) {
		return usernames.get(subject);
	}

	private UUID idOf(String subject) throws Exception {
		return UUID.fromString(get(subject, "/api/v1/me").get("id").asString());
	}

	private void befriend(String a, String b) throws Exception {
		sendRequest(a, usernameOf(b)).exchange();
		assertThat(sendRequest(b, usernameOf(a))).hasStatusOk().bodyJson().extractingPath("$.relationship").isEqualTo("FRIENDS");
	}

	private org.springframework.test.web.servlet.assertj.MockMvcTester.MockMvcRequestBuilder sendRequest(String from, String username) {
		return mvc.post().uri("/api/v1/friends/requests").with(as(from))
				.contentType(MediaType.APPLICATION_JSON).content("{\"username\": \"" + username + "\"}");
	}

	private org.springframework.test.web.servlet.assertj.MockMvcTester.MockMvcRequestBuilder patchMe(String subject, String json) {
		return mvc.patch().uri("/api/v1/me").with(as(subject)).contentType(MediaType.APPLICATION_JSON).content(json);
	}

	private JsonNode get(String subject, String uri) throws Exception {
		var result = mvc.get().uri(uri).with(as(subject)).exchange();
		assertThat(result).hasStatusOk();
		return json.readTree(result.getResponse().getContentAsString());
	}

	private UUID log(String subject, Instant startedAt, String exerciseName, double kg, int reps) throws Exception {
		var exercises = json.readTree(mvc.get().uri("/api/v1/exercises?query={q}", exerciseName).with(as(subject))
				.exchange().getResponse().getContentAsString());
		UUID exerciseId = null;
		for (JsonNode e : exercises) {
			if (e.get("name").asString().equals(exerciseName)) {
				exerciseId = UUID.fromString(e.get("id").asString());
			}
		}
		UUID id = UUID.randomUUID();
		var request = new WorkoutRequest("Workout", startedAt, startedAt.plus(1, ChronoUnit.HOURS), null,
				startedAt.plus(1, ChronoUnit.HOURS), List.of(new WorkoutRequest.ExerciseEntry(UUID.randomUUID(), exerciseId,
						null, List.of(new WorkoutRequest.SetEntry(UUID.randomUUID(), SetType.WORKING, BigDecimal.valueOf(kg),
								WeightUnit.KG, reps, null, startedAt)))));
		assertThat(mvc.put().uri("/api/v1/workouts/{id}", id).with(as(subject))
				.contentType(MediaType.APPLICATION_JSON).content(toJson(request))).hasStatus(HttpStatus.CREATED);
		return id;
	}
}
