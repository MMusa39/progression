package com.progression.common.web;

import io.swagger.v3.oas.annotations.OpenAPIDefinition;
import io.swagger.v3.oas.annotations.enums.SecuritySchemeType;
import io.swagger.v3.oas.annotations.info.Info;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import io.swagger.v3.oas.annotations.security.SecurityScheme;
import org.springdoc.core.utils.SpringDocUtils;
import org.springframework.context.annotation.Configuration;

import com.progression.user.CurrentUser;

/**
 * OpenAPI metadata for the generated spec ({@code /v3/api-docs}) and Swagger UI
 * ({@code /swagger-ui.html}). Declares the bearer-token scheme so you can
 * click "Authorize" in Swagger UI, paste a token from {@code POST /dev/token},
 * and call the secured endpoints from the browser.
 */
@Configuration
@OpenAPIDefinition(
		info = @Info(title = "Progression API", version = "v1",
				description = "Workout logging and strength-progression analytics."),
		security = @SecurityRequirement(name = "bearerAuth"))
@SecurityScheme(name = "bearerAuth", type = SecuritySchemeType.HTTP, scheme = "bearer", bearerFormat = "JWT")
public class OpenApiConfig {

	static {
		// CurrentUser is injected from the access token, not sent by the client:
		// keep it out of the documented request parameters.
		SpringDocUtils.getConfig().addRequestWrapperToIgnore(CurrentUser.class);
	}
}
