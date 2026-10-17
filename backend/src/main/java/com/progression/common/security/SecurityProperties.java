package com.progression.common.security;

import org.springframework.boot.context.properties.ConfigurationProperties;

/**
 * Settings under {@code progression.security.*}.
 *
 * @param devJwtSecret HMAC secret for development tokens ({@code local}/{@code test} profiles only)
 * @param cognito      Amazon Cognito user pool whose access tokens are accepted; may be unset locally
 */
@ConfigurationProperties("progression.security")
public record SecurityProperties(String devJwtSecret, Cognito cognito) {

	/**
	 * @param issuerUri e.g. {@code https://cognito-idp.us-east-1.amazonaws.com/us-east-1_AbCdEf123}
	 * @param clientId  the mobile app client id; tokens issued to any other client are rejected
	 */
	public record Cognito(String issuerUri, String clientId) {

		public boolean isConfigured() {
			return issuerUri != null && !issuerUri.isBlank() && clientId != null && !clientId.isBlank();
		}
	}

	public boolean cognitoConfigured() {
		return cognito != null && cognito.isConfigured();
	}
}
