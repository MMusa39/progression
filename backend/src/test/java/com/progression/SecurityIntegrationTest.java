package com.progression;

import static org.assertj.core.api.Assertions.assertThat;

import org.junit.jupiter.api.Test;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.assertj.MvcTestResult;

class SecurityIntegrationTest extends IntegrationTest {

	@Test
	void apiRejectsRequestsWithoutAToken() {
		assertThat(mvc.get().uri("/api/v1/me")).hasStatus(HttpStatus.UNAUTHORIZED);
	}

	@Test
	void apiRejectsATokenWithAnInvalidSignature() {
		assertThat(mvc.get().uri("/api/v1/me").header("Authorization", "Bearer not.a.real-token"))
				.hasStatus(HttpStatus.UNAUTHORIZED);
	}

	@Test
	void healthEndpointIsPublic() {
		assertThat(mvc.get().uri("/actuator/health")).hasStatusOk();
	}

	/** End to end with a real signed token, not the test-support shortcut. */
	@Test
	void devTokenIsAcceptedByTheApi() throws Exception {
		MvcTestResult tokenResult = mvc.post().uri("/dev/token")
				.contentType(MediaType.APPLICATION_JSON)
				.content("""
						{"subject": "dev-token-test", "email": "lifter@example.com"}
						""")
				.exchange();
		assertThat(tokenResult).hasStatusOk();
		String token = json.readTree(tokenResult.getResponse().getContentAsString()).get("accessToken").asString();

		assertThat(mvc.get().uri("/api/v1/me").header("Authorization", "Bearer " + token))
				.hasStatusOk()
				.bodyJson().extractingPath("$.email").isEqualTo("lifter@example.com");
	}
}
