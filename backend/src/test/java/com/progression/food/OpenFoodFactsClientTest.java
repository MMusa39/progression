package com.progression.food;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.header;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.requestTo;
import static org.springframework.test.web.client.response.MockRestResponseCreators.withServerError;
import static org.springframework.test.web.client.response.MockRestResponseCreators.withSuccess;

import java.util.Map;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.http.MediaType;
import org.springframework.test.web.client.MockRestServiceServer;
import org.springframework.web.client.RestClient;

class OpenFoodFactsClientTest {

	private MockRestServiceServer server;
	private OpenFoodFactsClient client;

	@BeforeEach
	void setUp() {
		RestClient.Builder builder = RestClient.builder().baseUrl("https://off.test").defaultHeader("User-Agent", "Progression/test");
		server = MockRestServiceServer.bindTo(builder).build();
		client = new OpenFoodFactsClient(builder.build());
	}

	@Test
	void parsesAProduct() {
		server.expect(requestTo(org.hamcrest.Matchers.startsWith("https://off.test/api/v2/product/3017620422003.json")))
				.andExpect(header("User-Agent", "Progression/test"))
				.andRespond(withSuccess("""
						{"status": 1, "product": {
						  "product_name": "Nutella", "brands": "Ferrero, Nutella",
						  "serving_size": "15 g", "serving_quantity": 15,
						  "nutriments": {"energy-kcal_100g": 539, "proteins_100g": 6.3, "carbohydrates_100g": 57.5,
						                 "fat_100g": 30.9, "fiber_100g": "3.4"}}}
						""", MediaType.APPLICATION_JSON));

		var food = client.byBarcode("3017620422003").orElseThrow();

		assertThat(food.name()).isEqualTo("Nutella");
		assertThat(food.brand()).isEqualTo("Ferrero");
		assertThat(food.servingG()).isEqualTo(15.0);
		assertThat(food.per100g()).isEqualTo(new Nutrients(539, 6.3, 57.5, 30.9, 3.4));
	}

	@Test
	void unknownProductsAndOutagesAreJustNotFound() {
		server.expect(requestTo(org.hamcrest.Matchers.startsWith("https://off.test/api/v2/product/123456.json")))
				.andRespond(withSuccess("{\"status\": 0}", MediaType.APPLICATION_JSON));
		server.expect(requestTo(org.hamcrest.Matchers.startsWith("https://off.test/api/v2/product/654321.json")))
				.andRespond(withServerError());

		assertThat(client.byBarcode("123456")).isEmpty();
		assertThat(client.byBarcode("654321")).isEmpty();
	}

	@Test
	void fallsBackFromKilojoulesAndSkipsUnusableProducts() {
		var kjOnly = OpenFoodFactsClient.toFood(Map.of("product_name", "Oats",
				"nutriments", Map.of("energy_100g", 1556)), "111");
		assertThat(kjOnly.orElseThrow().per100g().kcal()).isEqualTo(371.9);

		assertThat(OpenFoodFactsClient.toFood(Map.of("nutriments", Map.of("energy-kcal_100g", 100)), "222")).isEmpty();
		assertThat(OpenFoodFactsClient.toFood(Map.of("product_name", "Mystery"), "333")).isEmpty();
	}
}
