package com.progression.common.ratelimit;

import static org.assertj.core.api.Assertions.assertThat;

import com.progression.IntegrationTest;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpStatus;
import org.springframework.test.context.TestPropertySource;

@TestPropertySource(properties = { "progression.rate-limit.requests-per-minute=5", "progression.rate-limit.lookups-per-minute=2" })
class RateLimitApiTest extends IntegrationTest {

	@Test
	void eachUserGetsTheirOwnBudgetAnd429sCarryRetryAfter() {
		String user = newUser();
		for (int i = 0; i < 5; i++) {
			assertThat(mvc.get().uri("/api/v1/me").with(as(user))).hasStatusOk();
		}
		var limited = mvc.get().uri("/api/v1/me").with(as(user)).exchange();
		assertThat(limited).hasStatus(HttpStatus.TOO_MANY_REQUESTS);
		assertThat(limited.getResponse().getHeader("Retry-After")).isEqualTo("12"); // 5/min → one every 12 s
		assertThat(mvc.get().uri("/api/v1/me").with(as(newUser()))).hasStatusOk();
	}

	@Test
	void lookupsHaveATighterLimit() {
		String user = newUser();
		assertThat(mvc.get().uri("/api/v1/foods/search?q=oat").with(as(user))).hasStatusOk();
		assertThat(mvc.get().uri("/api/v1/foods/search?q=oat").with(as(user))).hasStatusOk();
		assertThat(mvc.get().uri("/api/v1/foods/search?q=oat").with(as(user))).hasStatus(HttpStatus.TOO_MANY_REQUESTS);
	}

	@Test
	void healthChecksAreNeverLimited() {
		for (int i = 0; i < 10; i++) {
			assertThat(mvc.get().uri("/actuator/health")).hasStatusOk();
		}
	}
}
