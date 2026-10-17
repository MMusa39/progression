package com.progression.body;

import static org.assertj.core.api.Assertions.assertThat;

import java.time.LocalDate;

import com.progression.IntegrationTest;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import tools.jackson.databind.JsonNode;

class BodyWeightApiTest extends IntegrationTest {

	private static final LocalDate TODAY = LocalDate.now();

	@Test
	void logsWeighInsAndReturnsTheTrend() throws Exception {
		String user = newUser();
		log(user, TODAY.minusDays(2), "200", "LB");
		log(user, TODAY.minusDays(1), "199", "LB");
		log(user, TODAY, "90", "KG"); // mixed units are fine: everything is compared in kg

		JsonNode history = get(user, "/api/v1/body-weights");

		assertThat(history.get("entries")).hasSize(3);
		assertThat(history.get("entries").get(0).get("weight").asDouble()).isEqualTo(200.0);
		assertThat(history.get("entries").get(0).get("weightKg").asDouble()).isEqualTo(90.72);
		assertThat(history.get("currentTrendKg").asDouble()).isBetween(90.0, 90.72);
	}

	@Test
	void loggingTheSameDayReplacesIt() throws Exception {
		String user = newUser();
		log(user, TODAY, "180", "LB");
		log(user, TODAY, "179.5", "LB");

		JsonNode entries = get(user, "/api/v1/body-weights").get("entries");
		assertThat(entries).hasSize(1);
		assertThat(entries.get(0).get("weight").asDouble()).isEqualTo(179.5);
	}

	@Test
	void fromLimitsTheEntriesButTheTrendUsesAllHistory() throws Exception {
		String user = newUser();
		log(user, TODAY.minusDays(30), "100", "KG");
		log(user, TODAY, "90", "KG");

		JsonNode entries = get(user, "/api/v1/body-weights?from=" + TODAY.minusDays(7)).get("entries");
		assertThat(entries).hasSize(1);
		// Trend is still warmed up by the earlier entry, not reset to today's reading.
		assertThat(entries.get(0).get("trendKg").asDouble()).isGreaterThan(90.0);
	}

	@Test
	void deletingAndValidation() throws Exception {
		String user = newUser();
		log(user, TODAY, "80", "KG");
		assertThat(mvc.delete().uri("/api/v1/body-weights/{d}", TODAY).with(as(user))).hasStatus(HttpStatus.NO_CONTENT);
		assertThat(get(user, "/api/v1/body-weights").get("entries")).isEmpty();

		assertThat(put(user, TODAY.plusDays(5), "80", "KG")).hasStatus(HttpStatus.BAD_REQUEST); // future
		assertThat(put(user, TODAY, "5", "KG")).hasStatus(HttpStatus.BAD_REQUEST);              // implausible
	}

	@Test
	void weightsArePrivate() throws Exception {
		String user = newUser();
		log(user, TODAY, "80", "KG");
		assertThat(get(newUser(), "/api/v1/body-weights").get("entries")).isEmpty();
	}

	private void log(String user, LocalDate date, String weight, String unit) {
		assertThat(put(user, date, weight, unit)).hasStatus(HttpStatus.NO_CONTENT);
	}

	private org.springframework.test.web.servlet.assertj.MockMvcTester.MockMvcRequestBuilder put(String user, LocalDate date,
			String weight, String unit) {
		return mvc.put().uri("/api/v1/body-weights/{d}", date).with(as(user)).contentType(MediaType.APPLICATION_JSON)
				.content("{\"weight\": " + weight + ", \"weightUnit\": \"" + unit + "\", \"today\": \"" + TODAY + "\"}");
	}

	private JsonNode get(String user, String uri) throws Exception {
		var result = mvc.get().uri(uri).with(as(user)).exchange();
		assertThat(result).hasStatusOk();
		return json.readTree(result.getResponse().getContentAsString());
	}
}
