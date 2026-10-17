package com.progression.common.security;

import java.nio.charset.StandardCharsets;

import javax.crypto.SecretKey;
import javax.crypto.spec.SecretKeySpec;

import com.nimbusds.jose.jwk.source.ImmutableSecret;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.context.annotation.Profile;
import org.springframework.security.oauth2.jose.jws.MacAlgorithm;
import org.springframework.security.oauth2.jwt.JwtDecoder;
import org.springframework.security.oauth2.jwt.JwtEncoder;
import org.springframework.security.oauth2.jwt.JwtValidators;
import org.springframework.security.oauth2.jwt.NimbusJwtDecoder;
import org.springframework.security.oauth2.jwt.NimbusJwtEncoder;

/**
 * JWT signing and verification for local development and tests, so the API
 * and the mobile app can run without a Cognito user pool.
 *
 * <p>Tokens are signed with a shared HMAC-SHA256 secret from
 * {@code progression.security.dev-jwt-secret} and carry the issuer
 * {@value #ISSUER}. Production never loads this class, because of the
 * {@link Profile} restriction.
 */
@Configuration
@Profile({ "local", "test" })
public class DevJwtConfig {

	/** {@code iss} claim of development tokens; {@link SecurityConfig} routes it here. */
	public static final String ISSUER = "progression-local";

	/** Wrapper type, so this decoder is never mistaken for the application's main {@link JwtDecoder}. */
	public record DevJwtDecoder(JwtDecoder decoder) {
	}

	private final SecretKey key;

	DevJwtConfig(SecurityProperties properties) {
		this.key = new SecretKeySpec(properties.devJwtSecret().getBytes(StandardCharsets.UTF_8), "HmacSHA256");
	}

	@Bean
	DevJwtDecoder devJwtDecoder() {
		NimbusJwtDecoder decoder = NimbusJwtDecoder.withSecretKey(key).macAlgorithm(MacAlgorithm.HS256).build();
		decoder.setJwtValidator(JwtValidators.createDefaultWithIssuer(ISSUER));
		return new DevJwtDecoder(decoder);
	}

	@Bean
	JwtEncoder devJwtEncoder() {
		return new NimbusJwtEncoder(new ImmutableSecret<>(key));
	}
}
