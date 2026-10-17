package com.progression.common.ratelimit;

import static org.assertj.core.api.Assertions.assertThat;

import java.time.Duration;

import org.junit.jupiter.api.Test;
import org.springframework.mock.web.MockHttpServletRequest;

class RateLimiterTest {

	private static final RateLimiter.Limit THREE_PER_MINUTE = new RateLimiter.Limit("t", 3, Duration.ofMinutes(1));
	private static final long SECOND = 1_000_000_000L;

	@Test
	void allowsABurstUpToCapacityThenRefillsGradually() {
		RateLimiter limiter = new RateLimiter();
		for (int i = 0; i < 3; i++) {
			assertThat(limiter.tryAcquire("u", THREE_PER_MINUTE, 0).allowed()).isTrue();
		}
		RateLimiter.Decision denied = limiter.tryAcquire("u", THREE_PER_MINUTE, 0);
		assertThat(denied.allowed()).isFalse();
		assertThat(denied.retryAfter()).isEqualTo(Duration.ofSeconds(20)); // one token every 20 s

		assertThat(limiter.tryAcquire("u", THREE_PER_MINUTE, 19 * SECOND).allowed()).isFalse();
		assertThat(limiter.tryAcquire("u", THREE_PER_MINUTE, 20 * SECOND).allowed()).isTrue();
	}

	@Test
	void keysAndLimitsAreIndependent() {
		RateLimiter limiter = new RateLimiter();
		for (int i = 0; i < 3; i++) {
			limiter.tryAcquire("a", THREE_PER_MINUTE, 0);
		}
		assertThat(limiter.tryAcquire("a", THREE_PER_MINUTE, 0).allowed()).isFalse();
		assertThat(limiter.tryAcquire("b", THREE_PER_MINUTE, 0).allowed()).isTrue();
		assertThat(limiter.tryAcquire("a", new RateLimiter.Limit("other", 1, Duration.ofMinutes(1)), 0).allowed()).isTrue();
	}

	@Test
	void idleBucketsAreEvicted() {
		RateLimiter limiter = new RateLimiter();
		limiter.tryAcquire("a", THREE_PER_MINUTE, 0);
		limiter.evictIdle(16 * 60 * SECOND);
		assertThat(limiter.size()).isZero();
	}

	@Test
	void foodLookupsAndExportsCountAsLookups() {
		assertThat(RateLimitFilter.isLookup(new MockHttpServletRequest("GET", "/api/v1/foods/barcode/123"))).isTrue();
		assertThat(RateLimitFilter.isLookup(new MockHttpServletRequest("GET", "/api/v1/foods/search"))).isTrue();
		assertThat(RateLimitFilter.isLookup(new MockHttpServletRequest("GET", "/api/v1/me/export"))).isTrue();
		assertThat(RateLimitFilter.isLookup(new MockHttpServletRequest("GET", "/api/v1/workouts"))).isFalse();
	}
}
