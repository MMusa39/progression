package com.progression.food;

import org.springframework.boot.context.properties.ConfigurationProperties;

/**
 * Settings under {@code progression.food.*}.
 *
 * @param offBaseUrl Open Food Facts base URL
 * @param userAgent  Open Food Facts asks every app to identify itself
 */
@ConfigurationProperties("progression.food")
public record FoodProperties(String offBaseUrl, String userAgent) {

	public FoodProperties {
		offBaseUrl = offBaseUrl == null || offBaseUrl.isBlank() ? "https://world.openfoodfacts.org" : offBaseUrl;
		userAgent = userAgent == null || userAgent.isBlank()
				? "Progression/0.1 (https://github.com/MMusa39/progression)"
				: userAgent;
	}
}
