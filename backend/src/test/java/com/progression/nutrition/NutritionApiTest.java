package com.progression.nutrition;

import static org.assertj.core.api.Assertions.assertThat;

import java.time.LocalDate;
import java.util.UUID;

import com.progression.IntegrationTest;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import tools.jackson.databind.JsonNode;

class NutritionApiTest extends IntegrationTest {

	private static final LocalDate TODAY = LocalDate.now();

	private String profileJson(String goalDate, boolean adaptive, String currentWeight) {
		return """
				{"sex":"MALE","birthYear":%d,"heightCm":180,"activityLevel":"MODERATE","goalWeight":168,"weightUnit":"LB",
				 "goalDate":"%s","adaptive":%s,"currentWeight":%s,"today":"%s"}
				""".formatted(TODAY.getYear() - 30, goalDate, adaptive, currentWeight, TODAY);
	}

	@Test
	void noProfileMeansNoTargets() {
		String user = newUser();
		assertThat(mvc.get().uri("/api/v1/nutrition/profile").with(as(user))).hasStatus(HttpStatus.NO_CONTENT);
		assertThat(mvc.get().uri("/api/v1/nutrition/targets?today={t}", TODAY).with(as(user))).hasStatus(HttpStatus.NO_CONTENT);
	}

	@Test
	void setupLogsTheWeightAndProducesTargets() throws Exception {
		String user = newUser();
		assertThat(put(user, profileJson(TODAY.plusWeeks(16).toString(), false, "176"))).hasStatusOk();

		JsonNode weights = get(user, "/api/v1/body-weights");
		assertThat(weights.get("entries")).hasSize(1);

		JsonNode response = get(user, "/api/v1/nutrition/targets?today=" + TODAY);
		JsonNode t = response.get("targets");
		assertThat(response.get("currentWeightKg").asDouble()).isEqualTo(79.83);
		assertThat(t.get("goal").asString()).isEqualTo("LOSE");
		assertThat(t.get("tdeeSource").asString()).isEqualTo("FORMULA");
		assertThat(t.get("calories").asInt()).isEqualTo(2510); // 2,756 maintenance − 250 for 8 lb in 16 weeks
		assertThat(t.get("rateCapped").asBoolean()).isFalse();
	}

	@Test
	void rejectsPastGoalDates() {
		assertThat(put(newUser(), profileJson(TODAY.minusDays(1).toString(), false, "176"))).hasStatus(HttpStatus.BAD_REQUEST);
	}

	@Test
	void adaptiveTargetsUseLoggedIntakeAgainstTheWeightTrend() throws Exception {
		String user = newUser();
		// 21 days of eating ~2,300 kcal while weight holds steady → expenditure ≈ 2,300.
		for (int day = 21; day >= 1; day--) {
			LocalDate date = TODAY.minusDays(day);
			assertThat(mvc.put().uri("/api/v1/body-weights/{d}", date).with(as(user)).contentType(MediaType.APPLICATION_JSON)
					.content("{\"weight\": 80, \"weightUnit\": \"KG\", \"today\": \"" + TODAY + "\"}")).hasStatus(HttpStatus.NO_CONTENT);
			assertThat(mvc.put().uri("/api/v1/diary/entries/{id}", UUID.randomUUID()).with(as(user))
					.contentType(MediaType.APPLICATION_JSON)
					.content("{\"date\":\"" + date + "\",\"meal\":\"DINNER\",\"kind\":\"QUICK\",\"amount\":1,"
							+ "\"amountUnit\":\"SERVING\",\"quick\":{\"kcal\":2300}}")).hasStatusOk();
		}
		assertThat(put(user, """
				{"sex":"MALE","birthYear":%d,"heightCm":180,"activityLevel":"MODERATE","goalWeight":80,"weightUnit":"KG",
				 "goalDate":"%s","adaptive":true,"today":"%s"}
				""".formatted(TODAY.getYear() - 30, TODAY.plusWeeks(8), TODAY))).hasStatusOk();

		JsonNode response = get(user, "/api/v1/nutrition/targets?today=" + TODAY);
		assertThat(response.get("adaptiveLoggedDays").asInt()).isEqualTo(21);
		assertThat(response.get("targets").get("tdeeSource").asString()).isEqualTo("ADAPTIVE");
		// 75% observed (2,300) + 25% formula (2,759) ≈ 2,415
		assertThat(response.get("targets").get("tdee").asInt()).isBetween(2380, 2450);
	}

	private org.springframework.test.web.servlet.assertj.MockMvcTester.MockMvcRequestBuilder put(String user, String body) {
		return mvc.put().uri("/api/v1/nutrition/profile").with(as(user)).contentType(MediaType.APPLICATION_JSON).content(body);
	}

	private JsonNode get(String user, String uri) throws Exception {
		var result = mvc.get().uri(uri).with(as(user)).exchange();
		assertThat(result).hasStatusOk();
		return json.readTree(result.getResponse().getContentAsString());
	}
}
