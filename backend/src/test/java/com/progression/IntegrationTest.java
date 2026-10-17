package com.progression;

import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.jwt;

import java.util.UUID;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.context.annotation.Import;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.assertj.MockMvcTester;
import org.springframework.test.web.servlet.request.RequestPostProcessor;
import tools.jackson.databind.json.JsonMapper;

/**
 * Base class for integration tests: the full application (security,
 * controllers, services, JPA) running against a real PostgreSQL from
 * Testcontainers, driven through MockMvc.
 *
 * <p><b>Test isolation:</b> rather than wiping tables between tests, each test
 * signs in as a brand-new random user ({@link #newUser()}). Since all data is
 * scoped per user, tests can't see each other's data, and they can safely share
 * one database.
 */
@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
@Import(TestcontainersConfiguration.class)
public abstract class IntegrationTest {

	@Autowired
	protected MockMvcTester mvc;

	@Autowired
	protected JsonMapper json;

	/** A fresh identity-provider subject, i.e. a user who has never called the API. */
	protected static String newUser() {
		return "test-" + UUID.randomUUID();
	}

	/**
	 * Authenticates a request as {@code subject}. Spring Security's test support
	 * injects an already-verified JWT, so no real token needs to be signed.
	 */
	protected static RequestPostProcessor as(String subject) {
		return jwt().jwt(token -> token.subject(subject));
	}

	protected String toJson(Object value) {
		return json.writeValueAsString(value);
	}
}
