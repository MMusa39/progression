package com.progression.food;

import static org.assertj.core.api.Assertions.assertThat;

import java.time.LocalDate;
import java.util.UUID;

import com.progression.IntegrationTest;
import com.progression.TestFoodConfiguration.FakeFoodDatabase;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import tools.jackson.databind.JsonNode;

class FoodApiTest extends IntegrationTest {

	private static final LocalDate TODAY = LocalDate.now();

	@Autowired
	FakeFoodDatabase off;

	private String user;
	private String yogurtBarcode;

	@BeforeEach
	void setUp() {
		user = newUser();
		yogurtBarcode = String.valueOf(100_000_000_000L + (long) (Math.random() * 800_000_000_000L));
		off.products.put(yogurtBarcode, new ExternalFood(yogurtBarcode, "Greek Yogurt " + yogurtBarcode, "Fage", 170.0,
				"1 cup (170 g)", new Nutrients(59, 10.3, 3.6, 0.4, 0)));
	}

	@Test
	void barcodeLookupCachesTheProduct() throws Exception {
		int before = off.barcodeLookups.get();
		JsonNode first = get("/api/v1/foods/barcode/" + yogurtBarcode);
		JsonNode second = get("/api/v1/foods/barcode/" + yogurtBarcode);

		assertThat(first.get("brand").asString()).isEqualTo("Fage");
		assertThat(second.get("id").asString()).isEqualTo(first.get("id").asString());
		assertThat(off.barcodeLookups.get() - before).isEqualTo(1); // the second scan came from the cache
	}

	@Test
	void unknownBarcodeIsNotFound() {
		assertThat(mvc.get().uri("/api/v1/foods/barcode/{c}", "999999999999").with(as(user))).hasStatus(HttpStatus.NOT_FOUND);
	}

	@Test
	void customFoodsConvertLabelValuesToPer100g() throws Exception {
		JsonNode food = createCustomFood("Protein bar", 60, 240, 20);

		assertThat(food.get("custom").asBoolean()).isTrue();
		assertThat(food.get("per100g").get("kcal").asDouble()).isEqualTo(400.0);    // 240 kcal / 60 g
		assertThat(food.get("per100g").get("proteinG").asDouble()).isEqualTo(33.3);
		// Custom foods are private.
		var other = mvc.get().uri("/api/v1/foods/search?q={q}", "protein bar").with(as(newUser())).exchange();
		assertThat(json.readTree(other.getResponse().getContentAsString())).noneMatch(f -> f.get("id").equals(food.get("id")));
		String id = food.get("id").asString();
		assertThat(mvc.get().uri("/api/v1/foods/{id}", id).with(as(user))).hasStatusOk();
		assertThat(mvc.get().uri("/api/v1/foods/{id}", id).with(as(newUser()))).hasStatus(HttpStatus.NOT_FOUND);
	}

	@Test
	void logsFoodsByGramsOrServingsWithServerComputedNutrition() throws Exception {
		String foodId = get("/api/v1/foods/barcode/" + yogurtBarcode).get("id").asString();

		putEntry(UUID.randomUUID(), "{\"date\":\"" + TODAY + "\",\"meal\":\"BREAKFAST\",\"kind\":\"FOOD\",\"foodId\":\"" + foodId
				+ "\",\"amount\":1,\"amountUnit\":\"SERVING\"}");
		putEntry(UUID.randomUUID(), "{\"date\":\"" + TODAY + "\",\"meal\":\"SNACK\",\"kind\":\"FOOD\",\"foodId\":\"" + foodId
				+ "\",\"amount\":100,\"amountUnit\":\"G\"}");
		putEntry(UUID.randomUUID(), "{\"date\":\"" + TODAY + "\",\"meal\":\"DINNER\",\"kind\":\"QUICK\",\"amount\":1,"
				+ "\"amountUnit\":\"SERVING\",\"quick\":{\"name\":\"Restaurant pasta\",\"kcal\":850,\"proteinG\":30}}");

		JsonNode day = get("/api/v1/diary/" + TODAY);
		assertThat(day.get("entries")).hasSize(3);
		assertThat(day.get("entries").get(0).get("nutrients").get("kcal").asDouble()).isEqualTo(100.3); // 170 g × 0.59
		assertThat(day.get("totals").get("kcal").asDouble()).isEqualTo(100.3 + 59 + 850);
	}

	@Test
	void entriesCanBeEditedAndDeletedButNotTakenOver() throws Exception {
		UUID id = UUID.randomUUID();
		String quick = "{\"date\":\"" + TODAY + "\",\"meal\":\"LUNCH\",\"kind\":\"QUICK\",\"amount\":1,\"amountUnit\":\"SERVING\",\"quick\":{\"kcal\":%d}}";
		putEntry(id, quick.formatted(500));
		putEntry(id, quick.formatted(650)); // edit
		assertThat(get("/api/v1/diary/" + TODAY).get("totals").get("kcal").asDouble()).isEqualTo(650.0);

		assertThat(mvc.put().uri("/api/v1/diary/entries/{id}", id).with(as(newUser())).contentType(MediaType.APPLICATION_JSON)
				.content(quick.formatted(1))).hasStatus(HttpStatus.NOT_FOUND);

		assertThat(mvc.delete().uri("/api/v1/diary/entries/{id}", id).with(as(user))).hasStatus(HttpStatus.NO_CONTENT);
		assertThat(get("/api/v1/diary/" + TODAY).get("entries")).isEmpty();
	}

	@Test
	void copyYesterdaysBreakfast() throws Exception {
		String foodId = get("/api/v1/foods/barcode/" + yogurtBarcode).get("id").asString();
		LocalDate yesterday = TODAY.minusDays(1);
		putEntry(UUID.randomUUID(), "{\"date\":\"" + yesterday + "\",\"meal\":\"BREAKFAST\",\"kind\":\"FOOD\",\"foodId\":\"" + foodId
				+ "\",\"amount\":1,\"amountUnit\":\"SERVING\"}");
		putEntry(UUID.randomUUID(), "{\"date\":\"" + yesterday + "\",\"meal\":\"DINNER\",\"kind\":\"QUICK\",\"amount\":1,"
				+ "\"amountUnit\":\"SERVING\",\"quick\":{\"kcal\":700}}");

		var result = mvc.post().uri("/api/v1/diary/{d}/copy", TODAY).with(as(user)).contentType(MediaType.APPLICATION_JSON)
				.content("{\"fromDate\":\"" + yesterday + "\",\"meal\":\"BREAKFAST\"}").exchange();
		assertThat(result).hasStatusOk();
		JsonNode day = json.readTree(result.getResponse().getContentAsString());
		assertThat(day.get("entries")).hasSize(1);
		assertThat(day.get("entries").get(0).get("meal").asString()).isEqualTo("BREAKFAST");
	}

	@Test
	void recipesComputePerServingNutritionAndLogBySnapshot() throws Exception {
		String oats = createCustomFood("Oats", 40, 150, 5).get("id").asString();
		String yogurt = get("/api/v1/foods/barcode/" + yogurtBarcode).get("id").asString();
		UUID recipeId = UUID.randomUUID();

		var saved = mvc.put().uri("/api/v1/recipes/{id}", recipeId).with(as(user)).contentType(MediaType.APPLICATION_JSON)
				.content("{\"name\":\"Overnight oats\",\"servings\":2,\"ingredients\":[{\"foodId\":\"" + oats
						+ "\",\"grams\":80},{\"foodId\":\"" + yogurt + "\",\"grams\":340}]}").exchange();
		assertThat(saved).hasStatusOk();
		JsonNode recipe = json.readTree(saved.getResponse().getContentAsString());
		// (80 g oats = 300 kcal) + (340 g yogurt = 200.6 kcal) = 500.6 → 250.3 per serving
		assertThat(recipe.get("perServing").get("kcal").asDouble()).isEqualTo(250.3);

		putEntry(UUID.randomUUID(), "{\"date\":\"" + TODAY + "\",\"meal\":\"BREAKFAST\",\"kind\":\"RECIPE\",\"recipeId\":\""
				+ recipeId + "\",\"amount\":1.5,\"amountUnit\":\"SERVING\"}");
		assertThat(mvc.delete().uri("/api/v1/recipes/{id}", recipeId).with(as(user))).hasStatus(HttpStatus.NO_CONTENT);

		// Deleting the recipe doesn't change what was logged.
		JsonNode entry = get("/api/v1/diary/" + TODAY).get("entries").get(0);
		assertThat(entry.get("name").asString()).isEqualTo("Overnight oats");
		assertThat(entry.get("nutrients").get("kcal").asDouble()).isEqualTo(375.5);
	}

	@Test
	void recentFoodsRememberTheLastAmount() throws Exception {
		String foodId = get("/api/v1/foods/barcode/" + yogurtBarcode).get("id").asString();
		putEntry(UUID.randomUUID(), "{\"date\":\"" + TODAY + "\",\"meal\":\"SNACK\",\"kind\":\"FOOD\",\"foodId\":\"" + foodId
				+ "\",\"amount\":150,\"amountUnit\":\"G\"}");

		JsonNode recent = get("/api/v1/foods/recent");
		assertThat(recent).hasSize(1);
		assertThat(recent.get(0).get("food").get("id").asString()).isEqualTo(foodId);
		assertThat(recent.get(0).get("lastAmount").asDouble()).isEqualTo(150.0);
	}

	@Test
	void water() throws Exception {
		assertThat(mvc.put().uri("/api/v1/diary/{d}/water", TODAY).with(as(user)).contentType(MediaType.APPLICATION_JSON)
				.content("{\"ml\": 1500}")).hasStatusOk();
		assertThat(get("/api/v1/diary/" + TODAY).get("waterMl").asInt()).isEqualTo(1500);
	}

	private JsonNode createCustomFood(String name, double servingG, double kcal, double protein) throws Exception {
		var result = mvc.post().uri("/api/v1/foods").with(as(user)).contentType(MediaType.APPLICATION_JSON)
				.content("{\"name\":\"" + name + "\",\"servingG\":" + servingG + ",\"servingLabel\":\"1 serving\","
						+ "\"perServingValues\":{\"kcal\":" + kcal + ",\"proteinG\":" + protein + "}}").exchange();
		assertThat(result).hasStatus(HttpStatus.CREATED);
		return json.readTree(result.getResponse().getContentAsString());
	}

	private void putEntry(UUID id, String body) {
		assertThat(mvc.put().uri("/api/v1/diary/entries/{id}", id).with(as(user)).contentType(MediaType.APPLICATION_JSON)
				.content(body)).hasStatusOk();
	}

	private JsonNode get(String uri) throws Exception {
		var result = mvc.get().uri(uri).with(as(user)).exchange();
		assertThat(result).hasStatusOk();
		return json.readTree(result.getResponse().getContentAsString());
	}
}
