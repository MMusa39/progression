package com.progression.common.security;

import static org.assertj.core.api.Assertions.assertThat;

import java.time.Instant;

import org.junit.jupiter.api.Test;
import org.springframework.security.oauth2.core.OAuth2TokenValidator;
import org.springframework.security.oauth2.jwt.Jwt;

/**
 * The signature check is Nimbus's job; these tests cover the claim rules we
 * add on top, which are what stop a validly signed but wrong kind of token.
 */
class CognitoTokenValidatorTest {

	private static final String ISSUER = "https://cognito-idp.us-east-1.amazonaws.com/us-east-1_TestPool";
	private static final String CLIENT_ID = "mobile-app-client";

	private final OAuth2TokenValidator<Jwt> validator = SecurityConfig
			.cognitoValidator(new SecurityProperties.Cognito(ISSUER, CLIENT_ID));

	@Test
	void acceptsAccessTokenForOurClient() {
		assertThat(validator.validate(token(ISSUER, "access", CLIENT_ID)).hasErrors()).isFalse();
	}

	@Test
	void rejectsIdTokens() {
		assertThat(validator.validate(token(ISSUER, "id", CLIENT_ID)).hasErrors()).isTrue();
	}

	@Test
	void rejectsTokensIssuedToAnotherClient() {
		assertThat(validator.validate(token(ISSUER, "access", "some-other-client")).hasErrors()).isTrue();
	}

	@Test
	void rejectsTokensFromAnotherUserPool() {
		String otherPool = "https://cognito-idp.us-east-1.amazonaws.com/us-east-1_OtherPool";
		assertThat(validator.validate(token(otherPool, "access", CLIENT_ID)).hasErrors()).isTrue();
	}

	private static Jwt token(String issuer, String tokenUse, String clientId) {
		Instant now = Instant.now();
		return Jwt.withTokenValue("token")
				.header("alg", "RS256")
				.issuer(issuer)
				.subject("user-123")
				.claim("token_use", tokenUse)
				.claim("client_id", clientId)
				.issuedAt(now)
				.expiresAt(now.plusSeconds(3600))
				.build();
	}
}
