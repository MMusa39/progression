package com.progression.common;

import java.time.Clock;

import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

/**
 * Provides the application's {@link Clock}. Code that needs "now" takes a Clock
 * instead of calling {@code Instant.now()}, so tests can pin time.
 */
@Configuration
public class TimeConfig {

	@Bean
	Clock clock() {
		return Clock.systemUTC();
	}
}
