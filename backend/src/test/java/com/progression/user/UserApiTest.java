package com.progression.user;

import static org.assertj.core.api.Assertions.assertThat;

import com.progression.IntegrationTest;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;

class UserApiTest extends IntegrationTest {

	@Test
	void firstRequestProvisionsUserWithDefaults() {
		String user = newUser();

		assertThat(mvc.get().uri("/api/v1/me").with(as(user)))
				.hasStatusOk()
				.bodyJson()
				.satisfies(body -> {
					assertThat(body).extractingPath("$.id").isNotNull();
					assertThat(body).extractingPath("$.weightUnit").isEqualTo("LB");
				});
	}

	@Test
	void repeatedRequestsReturnTheSameUser() throws Exception {
		String user = newUser();
		String first = mvc.get().uri("/api/v1/me").with(as(user)).exchange().getResponse().getContentAsString();
		String second = mvc.get().uri("/api/v1/me").with(as(user)).exchange().getResponse().getContentAsString();

		assertThat(json.readTree(second).get("id")).isEqualTo(json.readTree(first).get("id"));
	}

	@Test
	void patchUpdatesOnlyProvidedFields() {
		String user = newUser();

		assertThat(mvc.patch().uri("/api/v1/me").with(as(user))
				.contentType(MediaType.APPLICATION_JSON)
				.content("""
						{"displayName": "  Sam  ", "weightUnit": "KG"}
						"""))
				.hasStatusOk();

		assertThat(mvc.patch().uri("/api/v1/me").with(as(user))
				.contentType(MediaType.APPLICATION_JSON)
				.content("{}"))
				.hasStatusOk()
				.bodyJson()
				.satisfies(body -> {
					assertThat(body).extractingPath("$.displayName").isEqualTo("Sam");
					assertThat(body).extractingPath("$.weightUnit").isEqualTo("KG");
				});
	}

	@Test
	void patchRejectsTooLongDisplayName() {
		assertThat(mvc.patch().uri("/api/v1/me").with(as(newUser()))
				.contentType(MediaType.APPLICATION_JSON)
				.content("{\"displayName\": \"" + "x".repeat(51) + "\"}"))
				.hasStatus(HttpStatus.BAD_REQUEST)
				.bodyJson().extractingPath("$.errors[0].field").isEqualTo("displayName");
	}
}
