package com.progression.notification;

import org.springframework.context.annotation.Configuration;
import org.springframework.scheduling.annotation.EnableAsync;

/**
 * Enables {@code @Async}. With virtual threads on, Spring Boot's default task
 * executor runs each async call on its own virtual thread.
 */
@Configuration
@EnableAsync
class AsyncConfig {
}
