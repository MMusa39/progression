package com.progression.infra;

import java.util.List;
import java.util.Map;

import org.junit.jupiter.api.Test;
import software.amazon.awscdk.App;
import software.amazon.awscdk.Environment;
import software.amazon.awscdk.StackProps;
import software.amazon.awscdk.assertions.Match;
import software.amazon.awscdk.assertions.Template;

/**
 * Snapshot-free assertions on the synthesized CloudFormation template: they pin
 * the security-relevant settings without being brittle about everything else.
 */
class AuthStackTest {

	private static final StackProps PROPS = StackProps.builder()
			.env(Environment.builder().account("123456789012").region("us-east-1").build())
			.build();

	private static Template synth(AuthStack.Config config) {
		return Template.fromStack(new AuthStack(new App(), "Test", PROPS, config));
	}

	@Test
	void usersSignInWithEmailOrPhone() {
		Template template = synth(new AuthStack.Config("progression-test", null, List.of()));

		template.hasResourceProperties("AWS::Cognito::UserPool", Map.of(
				"UsernameAttributes", List.of("email", "phone_number"),
				"AutoVerifiedAttributes", List.of("email", "phone_number")));
	}

	@Test
	void mobileClientIsPublicAndUsesCodeFlow() {
		Template template = synth(new AuthStack.Config("progression-test", null, List.of()));

		template.hasResourceProperties("AWS::Cognito::UserPoolClient", Map.of(
				"GenerateSecret", false,
				"AllowedOAuthFlows", List.of("code"),
				"PreventUserExistenceErrors", "ENABLED",
				"CallbackURLs", List.of(AuthStack.APP_CALLBACK_URL),
				"SupportedIdentityProviders", List.of("COGNITO")));
	}

	@Test
	void googleIsOffUnlessConfigured() {
		Template template = synth(new AuthStack.Config("progression-test", null, List.of()));

		template.resourceCountIs("AWS::Cognito::UserPoolIdentityProvider", 0);
	}

	@Test
	void googleProviderAndDevCallbacksWhenConfigured() {
		Template template = synth(new AuthStack.Config("progression-test", "google-client-id.apps.googleusercontent.com",
				List.of("exp://192.168.1.20:8081/--/auth")));

		template.hasResourceProperties("AWS::Cognito::UserPoolIdentityProvider", Map.of(
				"ProviderName", "Google",
				"ProviderType", "Google"));
		template.hasResourceProperties("AWS::Cognito::UserPoolClient", Map.of(
				"SupportedIdentityProviders", Match.arrayWith(List.of("COGNITO", "Google")),
				"CallbackURLs", List.of(AuthStack.APP_CALLBACK_URL, "exp://192.168.1.20:8081/--/auth")));
	}

	@Test
	void userPoolIsRetainedOnStackDeletion() {
		Template template = synth(new AuthStack.Config("progression-test", null, List.of()));

		template.hasResource("AWS::Cognito::UserPool", Map.of("DeletionPolicy", "Retain"));
	}
}
