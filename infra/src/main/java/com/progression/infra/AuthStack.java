package com.progression.infra;

import java.util.ArrayList;
import java.util.List;

import software.amazon.awscdk.CfnOutput;
import software.amazon.awscdk.Duration;
import software.amazon.awscdk.RemovalPolicy;
import software.amazon.awscdk.SecretValue;
import software.amazon.awscdk.Stack;
import software.amazon.awscdk.StackProps;
import software.amazon.awscdk.services.cognito.AccountRecovery;
import software.amazon.awscdk.services.cognito.AttributeMapping;
import software.amazon.awscdk.services.cognito.AuthFlow;
import software.amazon.awscdk.services.cognito.AutoVerifiedAttrs;
import software.amazon.awscdk.services.cognito.CognitoDomainOptions;
import software.amazon.awscdk.services.cognito.FeaturePlan;
import software.amazon.awscdk.services.cognito.KeepOriginalAttrs;
import software.amazon.awscdk.services.cognito.ManagedLoginVersion;
import software.amazon.awscdk.services.cognito.OAuthFlows;
import software.amazon.awscdk.services.cognito.OAuthScope;
import software.amazon.awscdk.services.cognito.OAuthSettings;
import software.amazon.awscdk.services.cognito.PasswordPolicy;
import software.amazon.awscdk.services.cognito.ProviderAttribute;
import software.amazon.awscdk.services.cognito.SignInAliases;
import software.amazon.awscdk.services.cognito.StandardAttribute;
import software.amazon.awscdk.services.cognito.StandardAttributes;
import software.amazon.awscdk.services.cognito.UserPool;
import software.amazon.awscdk.services.cognito.UserPoolClient;
import software.amazon.awscdk.services.cognito.UserPoolClientIdentityProvider;
import software.amazon.awscdk.services.cognito.UserPoolClientOptions;
import software.amazon.awscdk.services.cognito.UserPoolDomain;
import software.amazon.awscdk.services.cognito.UserPoolDomainOptions;
import software.amazon.awscdk.services.cognito.UserPoolIdentityProviderGoogle;
import software.amazon.awscdk.services.cognito.UserVerificationConfig;
import software.amazon.awscdk.services.cognito.VerificationEmailStyle;
import software.constructs.Construct;

/**
 * User authentication: an Amazon Cognito user pool where people register and
 * sign in with an <b>email address</b>, a <b>phone number</b>, or their
 * <b>Google account</b>.
 *
 * <h2>How the pieces fit</h2>
 * <ul>
 *   <li><b>User pool</b>: the user directory. Email and phone are both
 *       "username attributes", so either can be used to sign in, and each is
 *       verified with a one-time code (email via Cognito, SMS via Amazon SNS).</li>
 *   <li><b>Google identity provider</b> (optional): federated sign-in. Cognito
 *       handles the OAuth exchange with Google and issues its own tokens, so
 *       the API only ever has to trust one issuer.</li>
 *   <li><b>App client</b>: the mobile app's registration. It's a <em>public</em>
 *       client (no secret, since a secret can't be kept on a phone), using
 *       USER_PASSWORD_AUTH for email/phone and authorization code + PKCE for Google.</li>
 *   <li><b>Domain</b>: hosts the OAuth endpoints used for the Google redirect flow.</li>
 * </ul>
 */
public class AuthStack extends Stack {

	/** Secrets Manager secret (plain text) holding the Google OAuth client secret. */
	public static final String GOOGLE_SECRET_NAME = "progression/google-oauth-client-secret";

	/** Redirect URL of standalone / development builds (app.json "scheme"). */
	public static final String APP_CALLBACK_URL = "progression://auth";

	/**
	 * @param domainPrefix    globally unique prefix for {@code <prefix>.auth.<region>.amazoncognito.com}
	 * @param googleClientId  Google OAuth client id, or {@code null} to disable Google sign-in
	 * @param devCallbackUrls extra redirect URLs for development (Expo Go)
	 */
	public record Config(String domainPrefix, String googleClientId, List<String> devCallbackUrls) {

		boolean googleEnabled() {
			return googleClientId != null && !googleClientId.isBlank();
		}
	}

	private final UserPool userPool;
	private final UserPoolClient mobileClient;

	public AuthStack(Construct scope, String id, StackProps props, Config config) {
		super(scope, id, props);

		userPool = UserPool.Builder.create(this, "UserPool")
				.userPoolName("progression-users")
				.selfSignUpEnabled(true)
				// Sign in with email OR phone number; the internal username is an opaque UUID.
				.signInAliases(SignInAliases.builder().email(true).phone(true).build())
				.signInCaseSensitive(false)
				.autoVerify(AutoVerifiedAttrs.builder().email(true).phone(true).build())
				// When a user changes their email/phone, keep the old one active until the new one is verified.
				.keepOriginal(KeepOriginalAttrs.builder().email(true).phone(true).build())
				.standardAttributes(StandardAttributes.builder()
						// Mutable: federated (Google) sign-ins update these on every login.
						.email(StandardAttribute.builder().required(false).mutable(true).build())
						.phoneNumber(StandardAttribute.builder().required(false).mutable(true).build())
						.givenName(StandardAttribute.builder().required(false).mutable(true).build())
						.familyName(StandardAttribute.builder().required(false).mutable(true).build())
						.fullname(StandardAttribute.builder().required(false).mutable(true).build())
						.build())
				.passwordPolicy(PasswordPolicy.builder()
						.minLength(8)
						.requireLowercase(true)
						.requireUppercase(true)
						.requireDigits(true)
						.requireSymbols(false)
						.build())
				.userVerification(UserVerificationConfig.builder()
						.emailStyle(VerificationEmailStyle.CODE)
						.emailSubject("Your Progression verification code")
						.emailBody("Your Progression verification code is {####}")
						.smsMessage("Your Progression verification code is {####}")
						.build())
				.accountRecovery(AccountRecovery.EMAIL_AND_PHONE_WITHOUT_MFA)
				// Essentials tier: free for the first 10,000 monthly active users.
				.featurePlan(FeaturePlan.ESSENTIALS)
				// Deleting the stack must never silently delete every user account.
				.removalPolicy(RemovalPolicy.RETAIN)
				.build();

		UserPoolDomain domain = userPool.addDomain("Domain", UserPoolDomainOptions.builder()
				.cognitoDomain(CognitoDomainOptions.builder().domainPrefix(config.domainPrefix()).build())
				.managedLoginVersion(ManagedLoginVersion.CLASSIC_HOSTED_UI)
				.build());

		List<UserPoolClientIdentityProvider> providers = new ArrayList<>();
		providers.add(UserPoolClientIdentityProvider.COGNITO);

		UserPoolIdentityProviderGoogle google = null;
		if (config.googleEnabled()) {
			google = UserPoolIdentityProviderGoogle.Builder.create(this, "Google")
					.userPool(userPool)
					.clientId(config.googleClientId())
					// Resolved by CloudFormation at deploy time; the secret never appears in the template.
					.clientSecretValue(SecretValue.secretsManager(GOOGLE_SECRET_NAME))
					.scopes(List.of("openid", "email", "profile"))
					.attributeMapping(AttributeMapping.builder()
							.email(ProviderAttribute.GOOGLE_EMAIL)
							.emailVerified(ProviderAttribute.GOOGLE_EMAIL_VERIFIED)
							.givenName(ProviderAttribute.GOOGLE_GIVEN_NAME)
							.familyName(ProviderAttribute.GOOGLE_FAMILY_NAME)
							.fullname(ProviderAttribute.GOOGLE_NAME)
							.build())
					.build();
			providers.add(UserPoolClientIdentityProvider.GOOGLE);
		}

		List<String> callbackUrls = new ArrayList<>();
		callbackUrls.add(APP_CALLBACK_URL);
		callbackUrls.addAll(config.devCallbackUrls());

		mobileClient = userPool.addClient("MobileClient", UserPoolClientOptions.builder()
				.userPoolClientName("progression-mobile")
				.generateSecret(false)
				.authFlows(AuthFlow.builder().userPassword(true).userSrp(true).build())
				.oAuth(OAuthSettings.builder()
						.flows(OAuthFlows.builder().authorizationCodeGrant(true).build())
						.scopes(List.of(OAuthScope.OPENID, OAuthScope.EMAIL, OAuthScope.PHONE, OAuthScope.PROFILE))
						.callbackUrls(callbackUrls)
						.logoutUrls(callbackUrls)
						.build())
				.supportedIdentityProviders(providers)
				// Sign-in failures don't reveal whether an account exists.
				.preventUserExistenceErrors(true)
				.enableTokenRevocation(true)
				.accessTokenValidity(Duration.hours(1))
				.idTokenValidity(Duration.hours(1))
				.refreshTokenValidity(Duration.days(30))
				.build());
		if (google != null) {
			// The client can't reference the Google provider until it exists.
			mobileClient.getNode().addDependency(google);
		}

		String issuerUri = "https://cognito-idp." + getRegion() + ".amazonaws.com/" + userPool.getUserPoolId();

		output("Region", getRegion(), "AWS region of the user pool");
		output("UserPoolId", userPool.getUserPoolId(), "Cognito user pool id");
		output("MobileClientId", mobileClient.getUserPoolClientId(),
				"App client id: EXPO_PUBLIC_COGNITO_CLIENT_ID (mobile) and COGNITO_CLIENT_ID (API)");
		output("IssuerUri", issuerUri, "Token issuer: COGNITO_ISSUER_URI for the API");
		output("OAuthDomain", domain.baseUrl(), "EXPO_PUBLIC_COGNITO_DOMAIN for the mobile app");
		output("GoogleSignInEnabled", String.valueOf(config.googleEnabled()), "Whether Google sign-in is configured");
	}

	private void output(String id, String value, String description) {
		CfnOutput.Builder.create(this, id).value(value).description(description).build();
	}

	public UserPool getUserPool() {
		return userPool;
	}

	public UserPoolClient getMobileClient() {
		return mobileClient;
	}
}
