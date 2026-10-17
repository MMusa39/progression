package com.progression.common.ratelimit;

import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.boot.context.properties.bind.DefaultValue;

/**
 * Request limits per user (or per IP before sign-in).
 *
 * @param enabled           off for local development, where the seed script floods the API
 * @param requestsPerMinute any endpoint
 * @param lookupsPerMinute  endpoints that call Open Food Facts or build large exports
 */
@ConfigurationProperties("progression.rate-limit")
public record RateLimitProperties(
		@DefaultValue("true") boolean enabled,
		@DefaultValue("300") int requestsPerMinute,
		@DefaultValue("30") int lookupsPerMinute) {
}
