package com.progression;

import org.springframework.boot.test.context.TestConfiguration;
import org.springframework.boot.testcontainers.service.connection.ServiceConnection;
import org.springframework.context.annotation.Bean;
import org.testcontainers.postgresql.PostgreSQLContainer;
import org.testcontainers.utility.DockerImageName;

/**
 * Starts a real PostgreSQL in Docker for integration tests, the same major
 * version as compose.yaml and production. {@link ServiceConnection} points the
 * application's datasource at it automatically, and Flyway migrates it on
 * startup, so every test run also verifies the migrations.
 *
 * <p>Spring caches the test application context, so one container is shared by
 * every test class that uses the same configuration.
 */
@TestConfiguration(proxyBeanMethods = false)
public class TestcontainersConfiguration {

	@Bean
	@ServiceConnection
	PostgreSQLContainer postgresContainer() {
		return new PostgreSQLContainer(DockerImageName.parse("postgres:18-alpine"));
	}
}
