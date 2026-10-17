package com.progression.account;

import static org.assertj.core.api.Assertions.assertThat;

import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
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

class AccountApiTest extends IntegrationTest {

	private static final LocalDate TODAY = LocalDate.now();

	@Test
	void exportContainsEverythingTheUserStored() throws Exception {
		String user = newUser();
		logWorkout(user);
		put(user, "/api/v1/body-weights/" + TODAY, "{\"weight\": 80.5, \"weightUnit\": \"KG\", \"today\": \"" + TODAY + "\"}");
		String foodId = json.readTree(post(user, "/api/v1/foods",
				"{\"name\": \"Oats\", \"servingG\": 40, \"perServingValues\": {\"kcal\": 150}}")).get("id").asString();
		put(user, "/api/v1/recipes/" + UUID.randomUUID(),
				"{\"name\": \"Porridge\", \"servings\": 1, \"ingredients\": [{\"foodId\": \"" + foodId + "\", \"grams\": 80}]}");
		put(user, "/api/v1/diary/entries/" + UUID.randomUUID(), "{\"date\": \"" + TODAY + "\", \"meal\": \"BREAKFAST\", "
				+ "\"kind\": \"FOOD\", \"foodId\": \"" + foodId + "\", \"amount\": 1, \"amountUnit\": \"SERVING\"}");

		var result = mvc.get().uri("/api/v1/me/export").with(as(user)).exchange();
		assertThat(result).hasStatusOk();
		assertThat(result.getResponse().getHeader("Content-Disposition")).contains("progression-export-");
		JsonNode export = json.readTree(result.getResponse().getContentAsString());

		assertThat(export.get("format").asString()).isEqualTo("progression-export-v1");
		assertThat(export.get("account").has("cognito_sub")).isFalse();
		JsonNode workout = export.get("workouts").get(0);
		assertThat(workout.get("exercises").get(0).get("exercise").asString()).isEqualTo("Bench Press");
		assertThat(workout.get("exercises").get(0).get("sets").get(0).get("reps").asInt()).isEqualTo(5);
		assertThat(export.get("bodyWeights").get(0).get("weight").asDouble()).isEqualTo(80.5);
		assertThat(export.get("customFoods").get(0).get("name").asString()).isEqualTo("Oats");
		assertThat(export.get("recipes").get(0).get("ingredients").get(0).get("food").asString()).isEqualTo("Oats");
		assertThat(export.get("foodDiary").get(0).get("kcal").asDouble()).isEqualTo(150.0);
	}

	@Test
	void deletingRemovesAllDataAndTheUserFromFriendsLists() throws Exception {
		String user = newUser();
		String friend = newUser();
		befriend(user, friend);
		logWorkout(user);
		put(user, "/api/v1/body-weights/" + TODAY, "{\"weight\": 80, \"weightUnit\": \"KG\", \"today\": \"" + TODAY + "\"}");
		String foodId = json.readTree(post(user, "/api/v1/foods",
				"{\"name\": \"Secret sauce\", \"servingG\": 10, \"perServingValues\": {\"kcal\": 50}}")).get("id").asString();
		UUID recipeId = UUID.randomUUID();
		put(user, "/api/v1/recipes/" + recipeId, "{\"name\": \"Shared bowl\", \"servings\": 1, \"shared\": true, "
				+ "\"ingredients\": [{\"foodId\": \"" + foodId + "\", \"grams\": 20}]}");
		UUID copyId = UUID.randomUUID();
		post(friend, "/api/v1/recipes/shared/" + recipeId + "/copy", "{\"id\": \"" + copyId + "\"}");

		assertThat(mvc.delete().uri("/api/v1/me").with(as(user))).hasStatus(HttpStatus.NO_CONTENT);

		assertThat(json.readTree(get(friend, "/api/v1/friends"))).isEmpty();
		// The friend's saved copy is theirs and survives.
		assertThat(mvc.get().uri("/api/v1/recipes/{id}", copyId).with(as(friend))).hasStatusOk();
		// Signing in again with the same identity starts from nothing.
		assertThat(json.readTree(get(user, "/api/v1/workouts")).get("items")).isEmpty();
		assertThat(json.readTree(get(user, "/api/v1/body-weights")).get("entries")).isEmpty();
	}

	// ---------------------------------------------------------------- helpers

	private void logWorkout(String user) throws Exception {
		JsonNode exercises = json.readTree(mvc.get().uri("/api/v1/exercises?query={q}", "Bench Press").with(as(user))
				.exchange().getResponse().getContentAsString());
		UUID benchId = null;
		for (JsonNode e : exercises) {
			if (e.get("name").asString().equals("Bench Press")) {
				benchId = UUID.fromString(e.get("id").asString());
			}
		}
		Instant start = Instant.now().minus(2, ChronoUnit.HOURS);
		var request = new WorkoutRequest("Push", start, start.plus(1, ChronoUnit.HOURS), null, start.plus(1, ChronoUnit.HOURS),
				List.of(new WorkoutRequest.ExerciseEntry(UUID.randomUUID(), benchId, null, List.of(new WorkoutRequest.SetEntry(
						UUID.randomUUID(), SetType.WORKING, BigDecimal.valueOf(100), WeightUnit.KG, 5, null, start)))));
		assertThat(mvc.put().uri("/api/v1/workouts/{id}", UUID.randomUUID()).with(as(user))
				.contentType(MediaType.APPLICATION_JSON).content(toJson(request))).hasStatus(HttpStatus.CREATED);
	}

	private void befriend(String a, String b) {
		String nameA = "a" + UUID.randomUUID().toString().replace("-", "").substring(0, 12);
		String nameB = "b" + UUID.randomUUID().toString().replace("-", "").substring(0, 12);
		assertThat(mvc.patch().uri("/api/v1/me").with(as(a)).contentType(MediaType.APPLICATION_JSON)
				.content("{\"username\": \"" + nameA + "\"}")).hasStatusOk();
		assertThat(mvc.patch().uri("/api/v1/me").with(as(b)).contentType(MediaType.APPLICATION_JSON)
				.content("{\"username\": \"" + nameB + "\"}")).hasStatusOk();
		post(a, "/api/v1/friends/requests", "{\"username\": \"" + nameB + "\"}");
		post(b, "/api/v1/friends/requests", "{\"username\": \"" + nameA + "\"}");
	}

	private String get(String user, String uri) throws Exception {
		var result = mvc.get().uri(uri).with(as(user)).exchange();
		assertThat(result).hasStatusOk();
		return result.getResponse().getContentAsString();
	}

	private String post(String user, String uri, String body) {
		var result = mvc.post().uri(uri).with(as(user)).contentType(MediaType.APPLICATION_JSON).content(body).exchange();
		assertThat(result).hasStatus2xxSuccessful();
		try {
			return result.getResponse().getContentAsString();
		}
		catch (java.io.UnsupportedEncodingException e) {
			throw new IllegalStateException(e);
		}
	}

	private void put(String user, String uri, String body) {
		assertThat(mvc.put().uri(uri).with(as(user)).contentType(MediaType.APPLICATION_JSON).content(body).exchange())
				.hasStatus2xxSuccessful();
	}
}
