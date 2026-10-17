package com.progression.notification;

import static org.assertj.core.api.Assertions.assertThat;

import java.math.BigDecimal;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.List;
import java.util.UUID;

import com.progression.IntegrationTest;
import com.progression.TestPushConfiguration.RecordingPushSender;
import com.progression.common.WeightUnit;
import com.progression.workout.SetType;
import com.progression.workout.WorkoutRequest;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import tools.jackson.databind.JsonNode;

/** Which events notify whom, end to end: request → service → event → listener → sender. */
class NotificationApiTest extends IntegrationTest {

	private static final Instant NOW = Instant.now();

	@Autowired
	RecordingPushSender sender;

	@Test
	void registeringValidatesTheTokenFormat() {
		assertThat(register(newUser(), "not-a-token")).hasStatus(HttpStatus.BAD_REQUEST);
		assertThat(register(newUser(), token())).hasStatus(HttpStatus.NO_CONTENT);
	}

	@Test
	void friendRequestNotifiesTheRecipient() throws Exception {
		String alice = withUsername("alice");
		String bob = withUsername("bob");
		String bobDevice = token();
		register(bob, bobDevice).exchange();

		sendRequest(alice, bob);

		List<PushMessage> received = sender.to(bobDevice);
		assertThat(received).hasSize(1);
		assertThat(received.get(0).title()).isEqualTo("New friend request");
		assertThat(received.get(0).body()).contains("@" + name(alice));
		assertThat(received.get(0).data()).containsEntry("path", "/friends");
	}

	@Test
	void acceptingNotifiesTheRequester() throws Exception {
		String alice = withUsername("alice");
		String bob = withUsername("bob");
		String aliceDevice = token();
		register(alice, aliceDevice).exchange();

		sendRequest(alice, bob);
		sendRequest(bob, alice); // asking back accepts

		assertThat(sender.to(aliceDevice)).singleElement()
				.satisfies(m -> assertThat(m.title()).startsWith("You're now friends with"));
	}

	@Test
	void preferencesAreRespected() throws Exception {
		String alice = withUsername("alice");
		String bob = withUsername("bob");
		String bobDevice = token();
		register(bob, bobDevice).exchange();
		patchMe(bob, "{\"notifyFriendRequests\": false}");

		sendRequest(alice, bob);

		assertThat(sender.to(bobDevice)).isEmpty();
	}

	@Test
	void aNewPrNotifiesFriendsOnceAndNotOnEdits() throws Exception {
		String lifter = withUsername("lifter");
		String friend = withUsername("friend");
		String stranger = withUsername("stranger");
		befriend(lifter, friend);
		String friendDevice = token();
		String strangerDevice = token();
		register(friend, friendDevice).exchange();
		register(stranger, strangerDevice).exchange();

		log(lifter, UUID.randomUUID(), NOW.minus(3, ChronoUnit.DAYS), 100, 5, NOW.minus(3, ChronoUnit.DAYS)); // baseline
		assertThat(sender.to(friendDevice)).isEmpty(); // first session: nothing to beat

		UUID workout = UUID.randomUUID();
		log(lifter, workout, NOW.minus(1, ChronoUnit.HOURS), 110, 5, NOW);
		assertThat(sender.to(friendDevice)).singleElement().satisfies(m -> {
			assertThat(m.title()).isEqualTo("@" + name(lifter) + " set a new PR");
			assertThat(m.body()).isEqualTo("Bench Press · 110 kg × 5");
			assertThat(m.data()).containsEntry("type", "friend_pr");
		});
		assertThat(sender.to(strangerDevice)).isEmpty();

		log(lifter, workout, NOW.minus(1, ChronoUnit.HOURS), 112.5, 5, NOW.plusSeconds(60)); // an edit
		assertThat(sender.to(friendDevice)).hasSize(1);
	}

	@Test
	void backfilledOldWorkoutsDoNotNotify() throws Exception {
		String lifter = withUsername("lifter");
		String friend = withUsername("friend");
		befriend(lifter, friend);
		String friendDevice = token();
		register(friend, friendDevice).exchange();

		log(lifter, UUID.randomUUID(), NOW.minus(30, ChronoUnit.DAYS), 100, 5, NOW.minus(30, ChronoUnit.DAYS));
		log(lifter, UUID.randomUUID(), NOW.minus(10, ChronoUnit.DAYS), 120, 5, NOW); // a PR, logged late

		assertThat(sender.to(friendDevice)).isEmpty();
	}

	@Test
	void deadTokensAreForgotten() throws Exception {
		String alice = withUsername("alice");
		String bob = withUsername("bob");
		String carol = withUsername("carol");
		String bobDevice = token();
		register(bob, bobDevice).exchange();
		sender.deadTokens.add(bobDevice);

		sendRequest(alice, bob);   // delivery reports the token dead → deleted
		sendRequest(carol, bob);   // so nothing is attempted this time

		assertThat(sender.to(bobDevice)).hasSize(1);
	}

	@Test
	void unregisteringStopsDelivery() throws Exception {
		String alice = withUsername("alice");
		String bob = withUsername("bob");
		String bobDevice = token();
		register(bob, bobDevice).exchange();

		assertThat(mvc.delete().uri("/api/v1/me/push-tokens/{t}", bobDevice).with(as(bob))).hasStatus(HttpStatus.NO_CONTENT);
		sendRequest(alice, bob);

		assertThat(sender.to(bobDevice)).isEmpty();
	}

	@Test
	void aDeviceMovesToWhoeverSignsInOnIt() throws Exception {
		String first = withUsername("first");
		String second = withUsername("second");
		String requester = withUsername("requester");
		String sharedDevice = token();
		register(first, sharedDevice).exchange();
		register(second, sharedDevice).exchange(); // second account signs in on the same phone

		sendRequest(requester, first);
		assertThat(sender.to(sharedDevice)).isEmpty();
		sendRequest(requester, second);
		assertThat(sender.to(sharedDevice)).hasSize(1);
	}

	// ---------------------------------------------------------------- helpers

	private final java.util.Map<String, String> names = new java.util.HashMap<>();

	private static String token() {
		return "ExponentPushToken[" + UUID.randomUUID() + "]";
	}

	private String withUsername(String base) {
		String subject = newUser();
		String name = (base + "_" + UUID.randomUUID().toString().replace("-", "").substring(0, 8)).toLowerCase();
		assertThat(patchMe(subject, "{\"username\": \"" + name + "\"}")).hasStatusOk();
		names.put(subject, name);
		return subject;
	}

	private String name(String subject) {
		return names.get(subject);
	}

	private org.springframework.test.web.servlet.assertj.MvcTestResult patchMe(String subject, String body) {
		return mvc.patch().uri("/api/v1/me").with(as(subject)).contentType(MediaType.APPLICATION_JSON).content(body).exchange();
	}

	private org.springframework.test.web.servlet.assertj.MockMvcTester.MockMvcRequestBuilder register(String subject, String token) {
		return mvc.post().uri("/api/v1/me/push-tokens").with(as(subject)).contentType(MediaType.APPLICATION_JSON)
				.content("{\"token\": \"" + token + "\", \"platform\": \"IOS\"}");
	}

	private void sendRequest(String from, String to) {
		assertThat(mvc.post().uri("/api/v1/friends/requests").with(as(from)).contentType(MediaType.APPLICATION_JSON)
				.content("{\"username\": \"" + name(to) + "\"}")).hasStatusOk();
	}

	private void befriend(String a, String b) {
		sendRequest(a, b);
		sendRequest(b, a);
		sender.sent.clear(); // ignore the request/accept notifications in PR tests
	}

	private void log(String subject, UUID workoutId, Instant startedAt, double kg, int reps, Instant updatedAt) throws Exception {
		JsonNode exercises = json.readTree(mvc.get().uri("/api/v1/exercises?query={q}", "Bench Press").with(as(subject))
				.exchange().getResponse().getContentAsString());
		UUID bench = null;
		for (JsonNode e : exercises) {
			if (e.get("name").asString().equals("Bench Press")) {
				bench = UUID.fromString(e.get("id").asString());
			}
		}
		// Stable ids per workout so a second call with the same workoutId is an edit, not a new workout.
		UUID exerciseEntry = UUID.nameUUIDFromBytes((workoutId + "-e").getBytes());
		UUID set = UUID.nameUUIDFromBytes((workoutId + "-s").getBytes());
		var request = new WorkoutRequest("Workout", startedAt, startedAt.plus(1, ChronoUnit.HOURS), null, updatedAt,
				List.of(new WorkoutRequest.ExerciseEntry(exerciseEntry, bench, null, List.of(new WorkoutRequest.SetEntry(
						set, SetType.WORKING, BigDecimal.valueOf(kg), WeightUnit.KG, reps, null, startedAt)))));
		var result = mvc.put().uri("/api/v1/workouts/{id}", workoutId).with(as(subject))
				.contentType(MediaType.APPLICATION_JSON).content(toJson(request)).exchange();
		assertThat(result.getResponse().getStatus()).isIn(200, 201);
	}
}
