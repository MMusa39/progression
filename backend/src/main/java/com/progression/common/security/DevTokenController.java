package com.progression.common.security;

import java.time.Duration;
import java.time.Instant;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import org.springframework.context.annotation.Profile;
import org.springframework.security.oauth2.jose.jws.MacAlgorithm;
import org.springframework.security.oauth2.jwt.JwsHeader;
import org.springframework.security.oauth2.jwt.JwtClaimsSet;
import org.springframework.security.oauth2.jwt.JwtEncoder;
import org.springframework.security.oauth2.jwt.JwtEncoderParameters;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/**
 * Mints development access tokens so the API (and the mobile app) can be used
 * locally without Cognito. Exists only under the {@code local} and {@code test}
 * profiles; in production this endpoint simply isn't registered.
 *
 * <pre>{@code
 * curl -X POST localhost:8080/dev/token -H 'Content-Type: application/json' -d '{"subject":"dev-user"}'
 * }</pre>
 */
@RestController
@RequestMapping("/dev/token")
@Profile({ "local", "test" })
@Tag(name = "Development", description = "Local-only helpers. Not available in production.")
public class DevTokenController {

	/** Long-lived on purpose: local convenience. Cognito tokens in production last 1 hour. */
	private static final Duration TOKEN_LIFETIME = Duration.ofDays(30);

	private final JwtEncoder jwtEncoder;

	DevTokenController(JwtEncoder jwtEncoder) {
		this.jwtEncoder = jwtEncoder;
	}

	/**
	 * @param subject stable user identifier (the {@code sub} claim); each distinct value is a separate user
	 * @param email   optional email claim, shown on the user's profile
	 */
	public record DevTokenRequest(@NotBlank @Size(max = 100) String subject, @Email String email) {
	}

	public record DevTokenResponse(String accessToken, Instant expiresAt) {
	}

	@PostMapping
	@Operation(summary = "Mint a development access token for the given subject")
	public DevTokenResponse mint(@Validated @RequestBody DevTokenRequest request) {
		Instant now = Instant.now();
		JwtClaimsSet.Builder claims = JwtClaimsSet.builder()
				.issuer(DevJwtConfig.ISSUER)
				.subject(request.subject())
				.issuedAt(now)
				.expiresAt(now.plus(TOKEN_LIFETIME));
		if (request.email() != null) {
			claims.claim("email", request.email());
		}

		JwsHeader header = JwsHeader.with(MacAlgorithm.HS256).build();
		String token = jwtEncoder.encode(JwtEncoderParameters.from(header, claims.build())).getTokenValue();
		return new DevTokenResponse(token, now.plus(TOKEN_LIFETIME));
	}
}
