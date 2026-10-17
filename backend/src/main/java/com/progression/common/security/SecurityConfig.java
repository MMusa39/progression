package com.progression.common.security;

import java.util.HashMap;
import java.util.Map;
import java.util.Optional;

import com.progression.common.ratelimit.RateLimitFilter;
import com.progression.common.ratelimit.RateLimitProperties;
import com.progression.common.ratelimit.RateLimiter;
import jakarta.servlet.http.HttpServletRequest;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.authentication.AuthenticationManagerResolver;
import org.springframework.security.config.Customizer;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.oauth2.core.DelegatingOAuth2TokenValidator;
import org.springframework.security.oauth2.core.OAuth2TokenValidator;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.security.oauth2.jwt.JwtClaimValidator;
import org.springframework.security.oauth2.jwt.JwtDecoder;
import org.springframework.security.oauth2.jwt.JwtValidators;
import org.springframework.security.oauth2.jwt.NimbusJwtDecoder;
import org.springframework.security.oauth2.server.resource.authentication.JwtAuthenticationProvider;
import org.springframework.security.oauth2.server.resource.authentication.JwtIssuerAuthenticationManagerResolver;
import org.springframework.security.oauth2.server.resource.web.authentication.BearerTokenAuthenticationFilter;
import org.springframework.security.web.SecurityFilterChain;

/**
 * HTTP security for the API.
 *
 * <p>The API is a stateless OAuth2 <em>resource server</em>: it never handles
 * passwords or sessions. Clients sign in with an identity provider, then send
 * the resulting access token on every request as
 * {@code Authorization: Bearer <jwt>}.
 *
 * <h2>Trusted issuers</h2>
 * Tokens are routed by their {@code iss} (issuer) claim to the matching
 * verifier ({@link JwtIssuerAuthenticationManagerResolver}). A token from any
 * other issuer is rejected before its signature is even checked.
 * <ul>
 *   <li><b>Amazon Cognito</b> (when {@code progression.security.cognito.*} is set):
 *       RS256 signatures checked against the user pool's public keys (JWKS), plus
 *       the token must be an <em>access</em> token issued to <em>our</em> app client.</li>
 *   <li><b>Development issuer</b> ({@code local}/{@code test} profiles only):
 *       HS256 tokens from {@code POST /dev/token}; see {@link DevJwtConfig}.</li>
 * </ul>
 * Locally both can be active at once, so the app can use either the dev
 * account or a real Cognito account against the same backend.
 *
 * <p>CSRF protection is disabled because it only defends cookie-based sessions.
 * Bearer tokens are never sent automatically by a browser, so they aren't
 * exposed to CSRF.
 */
@Configuration
public class SecurityConfig {

	private static final Logger log = LoggerFactory.getLogger(SecurityConfig.class);

	@Bean
	SecurityFilterChain apiSecurity(HttpSecurity http,
			AuthenticationManagerResolver<HttpServletRequest> authenticationManagerResolver,
			RateLimitProperties rateLimits) throws Exception {
		if (rateLimits.enabled()) {
			// After authentication, so limits are per user rather than per shared IP.
			http.addFilterAfter(new RateLimitFilter(new RateLimiter(), rateLimits), BearerTokenAuthenticationFilter.class);
		}
		http
				// Uses a CorsConfigurationSource bean if one exists (local profile only, see LocalCorsConfig).
				.cors(Customizer.withDefaults())
				.csrf(csrf -> csrf.disable())
				.sessionManagement(session -> session.sessionCreationPolicy(SessionCreationPolicy.STATELESS))
				.authorizeHttpRequests(auth -> auth
						.requestMatchers(
								"/actuator/health/**",
								"/v3/api-docs/**", "/swagger-ui/**", "/swagger-ui.html",
								// Only exists under the local/test profiles (DevTokenController)
								"/dev/**")
						.permitAll()
						.anyRequest().authenticated())
				.oauth2ResourceServer(oauth2 -> oauth2.authenticationManagerResolver(authenticationManagerResolver));
		return http.build();
	}

	@Bean
	AuthenticationManagerResolver<HttpServletRequest> authenticationManagerResolver(SecurityProperties properties,
			Optional<DevJwtConfig.DevJwtDecoder> devDecoder) {
		Map<String, AuthenticationManager> managersByIssuer = new HashMap<>();

		if (properties.cognitoConfigured()) {
			SecurityProperties.Cognito cognito = properties.cognito();
			managersByIssuer.put(cognito.issuerUri(), managerFor(cognitoDecoder(cognito)));
			log.info("Accepting Cognito access tokens from {}", cognito.issuerUri());
		}
		devDecoder.ifPresent(dev -> {
			managersByIssuer.put(DevJwtConfig.ISSUER, managerFor(dev.decoder()));
			log.info("Accepting development tokens (issuer '{}')", DevJwtConfig.ISSUER);
		});

		if (managersByIssuer.isEmpty()) {
			throw new IllegalStateException("No token issuer configured: set progression.security.cognito.issuer-uri "
					+ "and client-id, or run with the 'local' profile");
		}
		return new JwtIssuerAuthenticationManagerResolver(managersByIssuer::get);
	}

	/**
	 * Verifies Cognito access tokens. The JWKS is fetched lazily on first use and
	 * cached, so the app starts even if Cognito is briefly unreachable.
	 *
	 * <p>Cognito access tokens carry {@code client_id} instead of the usual
	 * {@code aud} claim, and ID tokens are signed with the same keys. Both
	 * extra validators are needed to reject an ID token, or a token minted for
	 * a different app client in the same pool.
	 */
	static JwtDecoder cognitoDecoder(SecurityProperties.Cognito cognito) {
		NimbusJwtDecoder decoder = NimbusJwtDecoder
				.withJwkSetUri(cognito.issuerUri() + "/.well-known/jwks.json")
				.build();
		decoder.setJwtValidator(cognitoValidator(cognito));
		return decoder;
	}

	/** Claim checks applied after the signature is verified: issuer, expiry, token type, client. */
	static OAuth2TokenValidator<Jwt> cognitoValidator(SecurityProperties.Cognito cognito) {
		return new DelegatingOAuth2TokenValidator<>(
				JwtValidators.createDefaultWithIssuer(cognito.issuerUri()),
				new JwtClaimValidator<String>("token_use", "access"::equals),
				new JwtClaimValidator<String>("client_id", cognito.clientId()::equals));
	}

	private static AuthenticationManager managerFor(JwtDecoder decoder) {
		return new JwtAuthenticationProvider(decoder)::authenticate;
	}
}
