package com.progression.notification;

import org.springframework.boot.context.properties.ConfigurationProperties;

/**
 * Settings under {@code progression.push.*}.
 *
 * @param enabled     turn sending off entirely (tokens are still stored)
 * @param expoUrl     Expo push API endpoint
 * @param accessToken optional Expo access token, required only if "enhanced push security" is on for the project
 */
@ConfigurationProperties("progression.push")
public record PushProperties(Boolean enabled, String expoUrl, String accessToken) {

	public PushProperties {
		enabled = enabled == null || enabled;
		expoUrl = expoUrl == null || expoUrl.isBlank() ? "https://exp.host/--/api/v2/push/send" : expoUrl;
	}
}
