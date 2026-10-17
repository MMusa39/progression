package com.progression.food;

import static org.assertj.core.api.Assertions.assertThat;

import java.util.UUID;

import com.progression.IntegrationTest;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import tools.jackson.databind.JsonNode;

class SharedRecipeApiTest extends IntegrationTest {

	private String chef;
	private String friend;
	private String stranger;
	private UUID recipeId;
	private String oatsId;

	@BeforeEach
	void setUp() throws Exception {
		chef = withUsername(newUser());
		friend = withUsername(newUser());
		stranger = withUsername(newUser());
		befriend(chef, friend);

		oatsId = post(chef, "/api/v1/foods", """
				{"name": "Rolled oats", "servingG": 40, "perServingValues": {"kcal": 150, "proteinG": 5}}
				""").get("id").asString();
		recipeId = UUID.randomUUID();
		saveRecipe(recipeId, false);
	}

	@Test
	void privateRecipesAreInvisibleToFriends() throws Exception {
		assertThat(get(friend, "/api/v1/recipes/shared")).isEmpty();
		assertThat(mvc.get().uri("/api/v1/recipes/shared/{id}", recipeId).with(as(friend))).hasStatus(HttpStatus.NOT_FOUND);
	}

	@Test
	void friendsSeeSharedRecipesWithTheSharersCustomFoods() throws Exception {
		saveRecipe(recipeId, true);

		JsonNode shared = get(friend, "/api/v1/recipes/shared");
		assertThat(shared).hasSize(1);
		assertThat(shared.get(0).get("sharedBy").get("username").asString()).isEqualTo(usernames.get(chef));
		assertThat(shared.get(0).get("perServing").get("kcal").asDouble()).isEqualTo(150.0); // 80 g oats / 2 servings
		assertThat(shared.get(0).get("savedCopyId").isNull()).isTrue();
		// Strangers can't see it, and nobody can edit it.
		assertThat(get(stranger, "/api/v1/recipes/shared")).isEmpty();
		assertThat(mvc.get().uri("/api/v1/recipes/shared/{id}", recipeId).with(as(stranger))).hasStatus(HttpStatus.NOT_FOUND);
		assertThat(mvc.get().uri("/api/v1/recipes/{id}", recipeId).with(as(friend))).hasStatus(HttpStatus.NOT_FOUND);
	}

	@Test
	void savingACopyIsIndependentAndIdempotent() throws Exception {
		saveRecipe(recipeId, true);
		UUID copyId = UUID.randomUUID();

		JsonNode copy = post(friend, "/api/v1/recipes/shared/" + recipeId + "/copy", "{\"id\": \"" + copyId + "\"}");
		assertThat(copy.get("id").asString()).isEqualTo(copyId.toString());
		assertThat(copy.get("shared").asBoolean()).isFalse();
		assertThat(copy.get("perServing").get("kcal").asDouble()).isEqualTo(150.0);
		// The chef's custom food was copied into the friend's own foods.
		String copiedFood = copy.get("ingredients").get(0).get("food").get("id").asString();
		assertThat(copiedFood).isNotEqualTo(oatsId);

		// Saving again returns the same copy.
		JsonNode again = post(friend, "/api/v1/recipes/shared/" + recipeId + "/copy", "{\"id\": \"" + UUID.randomUUID() + "\"}");
		assertThat(again.get("id").asString()).isEqualTo(copyId.toString());
		assertThat(get(friend, "/api/v1/recipes/shared").get(0).get("savedCopyId").asString()).isEqualTo(copyId.toString());

		// The friend can log their copy, and it survives the original being deleted.
		assertThat(mvc.delete().uri("/api/v1/recipes/{id}", recipeId).with(as(chef))).hasStatus(HttpStatus.NO_CONTENT);
		assertThat(get(friend, "/api/v1/recipes/" + copyId).get("ingredients")).hasSize(1);
	}

	@Test
	void strangersCannotCopy() {
		saveRecipe(recipeId, true);
		assertThat(mvc.post().uri("/api/v1/recipes/shared/{id}/copy", recipeId).with(as(stranger))
				.contentType(MediaType.APPLICATION_JSON).content("{\"id\": \"" + UUID.randomUUID() + "\"}"))
				.hasStatus(HttpStatus.NOT_FOUND);
	}

	@Test
	void omittingSharedKeepsTheCurrentSetting() throws Exception {
		saveRecipe(recipeId, true);
		assertThat(mvc.put().uri("/api/v1/recipes/{id}", recipeId).with(as(chef)).contentType(MediaType.APPLICATION_JSON)
				.content("{\"name\": \"Oats v2\", \"servings\": 2, \"ingredients\": [{\"foodId\": \"" + oatsId + "\", \"grams\": 80}]}"))
				.hasStatusOk().bodyJson().extractingPath("$.shared").isEqualTo(true);
	}

	// ---------------------------------------------------------------- helpers

	private final java.util.Map<String, String> usernames = new java.util.HashMap<>();

	private String withUsername(String subject) {
		String username = "r" + UUID.randomUUID().toString().replace("-", "").substring(0, 12);
		assertThat(mvc.patch().uri("/api/v1/me").with(as(subject)).contentType(MediaType.APPLICATION_JSON)
				.content("{\"username\": \"" + username + "\"}")).hasStatusOk();
		usernames.put(subject, username);
		return subject;
	}

	private void befriend(String a, String b) {
		assertThat(mvc.post().uri("/api/v1/friends/requests").with(as(a)).contentType(MediaType.APPLICATION_JSON)
				.content("{\"username\": \"" + usernames.get(b) + "\"}")).hasStatusOk();
		assertThat(mvc.post().uri("/api/v1/friends/requests").with(as(b)).contentType(MediaType.APPLICATION_JSON)
				.content("{\"username\": \"" + usernames.get(a) + "\"}"))
				.hasStatusOk().bodyJson().extractingPath("$.relationship").isEqualTo("FRIENDS");
	}

	private void saveRecipe(UUID id, boolean shared) {
		assertThat(mvc.put().uri("/api/v1/recipes/{id}", id).with(as(chef)).contentType(MediaType.APPLICATION_JSON)
				.content("{\"name\": \"Overnight oats\", \"servings\": 2, \"shared\": " + shared
						+ ", \"ingredients\": [{\"foodId\": \"" + oatsId + "\", \"grams\": 80}]}"))
				.hasStatusOk();
	}

	private JsonNode get(String subject, String uri) throws Exception {
		var result = mvc.get().uri(uri).with(as(subject)).exchange();
		assertThat(result).hasStatusOk();
		return json.readTree(result.getResponse().getContentAsString());
	}

	private JsonNode post(String subject, String uri, String body) throws Exception {
		var result = mvc.post().uri(uri).with(as(subject)).contentType(MediaType.APPLICATION_JSON).content(body).exchange();
		assertThat(result).hasStatus2xxSuccessful();
		return json.readTree(result.getResponse().getContentAsString());
	}
}
