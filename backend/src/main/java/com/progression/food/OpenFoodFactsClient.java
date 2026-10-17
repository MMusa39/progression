package com.progression.food;

import java.net.http.HttpClient;
import java.time.Duration;
import java.util.List;
import java.util.Map;
import java.util.Optional;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.client.JdkClientHttpRequestFactory;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestClient;
import org.springframework.web.client.RestClientException;

/**
 * Client for <a href="https://world.openfoodfacts.org">Open Food Facts</a>, a
 * free, open database of 3M+ packaged foods with barcodes. No API key is
 * needed; the API asks for a descriptive User-Agent.
 *
 * <p>Network failures and malformed products degrade to "not found" or "no
 * results": food search should never return an error because a third party is slow.
 */
@Component
class OpenFoodFactsClient implements FoodDatabase {

	private static final Logger log = LoggerFactory.getLogger(OpenFoodFactsClient.class);
	private static final String FIELDS = "code,product_name,brands,nutriments,serving_size,serving_quantity";
	private static final int SEARCH_PAGE_SIZE = 20;

	private final RestClient http;

	@Autowired
	OpenFoodFactsClient(RestClient.Builder builder, FoodProperties properties) {
		// Short timeouts: a slow third party should degrade search, not hang the app.
		JdkClientHttpRequestFactory requestFactory = new JdkClientHttpRequestFactory(
				HttpClient.newBuilder().connectTimeout(Duration.ofSeconds(4)).build());
		requestFactory.setReadTimeout(Duration.ofSeconds(8));
		this.http = builder.baseUrl(properties.offBaseUrl())
				.defaultHeader("User-Agent", properties.userAgent())
				.requestFactory(requestFactory)
				.build();
	}

	/** For tests: use a pre-built client (e.g. bound to a mock server). */
	OpenFoodFactsClient(RestClient http) {
		this.http = http;
	}

	record ProductResponse(Integer status, Map<String, Object> product) {
	}

	record SearchResponse(List<Map<String, Object>> products) {
	}

	@Override
	public Optional<ExternalFood> byBarcode(String barcode) {
		try {
			ProductResponse response = http.get()
					.uri("/api/v2/product/{code}.json?fields={fields}", barcode, FIELDS)
					.retrieve()
					.onStatus(status -> status.value() == 404, (req, res) -> { })
					.body(ProductResponse.class);
			if (response == null || response.status() == null || response.status() != 1 || response.product() == null) {
				return Optional.empty();
			}
			return toFood(response.product(), barcode);
		}
		catch (RestClientException ex) {
			log.warn("Open Food Facts barcode lookup failed: {}", ex.getMessage());
			return Optional.empty();
		}
	}

	@Override
	public List<ExternalFood> search(String query) {
		try {
			SearchResponse response = http.get()
					.uri("/cgi/search.pl?search_terms={q}&search_simple=1&action=process&json=1&page_size={size}&fields={fields}",
							query, SEARCH_PAGE_SIZE, FIELDS)
					.retrieve()
					.body(SearchResponse.class);
			if (response == null || response.products() == null) {
				return List.of();
			}
			return response.products().stream()
					.map(p -> toFood(p, String.valueOf(p.getOrDefault("code", ""))))
					.flatMap(Optional::stream)
					.toList();
		}
		catch (RestClientException ex) {
			log.warn("Open Food Facts search failed: {}", ex.getMessage());
			return List.of();
		}
	}

	/**
	 * Normalizes an Open Food Facts product. Products missing a name or an
	 * energy value are skipped: they can't be logged meaningfully.
	 */
	static Optional<ExternalFood> toFood(Map<String, Object> product, String barcode) {
		String name = text(product.get("product_name"));
		if (name == null || barcode == null || barcode.isBlank()) {
			return Optional.empty();
		}
		@SuppressWarnings("unchecked")
		Map<String, Object> n = product.get("nutriments") instanceof Map<?, ?> m ? (Map<String, Object>) m : Map.of();
		Double kcal = number(n.get("energy-kcal_100g"));
		if (kcal == null) {
			Double kj = number(n.get("energy_100g")); // some products only list kJ
			kcal = kj == null ? null : kj / 4.184;
		}
		if (kcal == null) {
			return Optional.empty();
		}
		Nutrients per100 = new Nutrients(kcal, orZero(n.get("proteins_100g")), orZero(n.get("carbohydrates_100g")),
				orZero(n.get("fat_100g")), orZero(n.get("fiber_100g"))).rounded();
		String brand = text(product.get("brands"));
		if (brand != null && brand.contains(",")) {
			brand = brand.substring(0, brand.indexOf(',')).trim(); // first brand only
		}
		Double servingG = number(product.get("serving_quantity"));
		return Optional.of(new ExternalFood(barcode, name.trim(), brand,
				servingG != null && servingG > 0 ? servingG : null, text(product.get("serving_size")), per100));
	}

	private static String text(Object value) {
		return value instanceof String s && !s.isBlank() ? s : null;
	}

	private static Double number(Object value) {
		if (value instanceof Number num) {
			return num.doubleValue();
		}
		if (value instanceof String s) {
			try {
				return Double.parseDouble(s.trim());
			}
			catch (NumberFormatException ex) {
				return null;
			}
		}
		return null;
	}

	private static double orZero(Object value) {
		Double n = number(value);
		return n == null || n < 0 ? 0 : n;
	}
}
