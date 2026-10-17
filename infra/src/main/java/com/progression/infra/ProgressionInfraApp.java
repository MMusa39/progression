package com.progression.infra;

import java.util.Arrays;
import java.util.List;

import software.amazon.awscdk.App;
import software.amazon.awscdk.Environment;
import software.amazon.awscdk.StackProps;

/**
 * Entry point of the CDK app: decides which stacks exist and with what
 * configuration. CDK runs this program to produce CloudFormation templates.
 *
 * <p>Optional context values (pass with {@code cdk deploy -c key=value}, or set them
 * in {@code cdk.json}):
 * <ul>
 *   <li>{@code googleClientId}: Google OAuth client id. When set, "Sign in with Google" is enabled.
 *       The client secret is read from Secrets Manager ({@value AuthStack#GOOGLE_SECRET_NAME}).</li>
 *   <li>{@code devCallbackUrls}: comma-separated extra OAuth redirect URLs for development,
 *       e.g. the Expo Go URL {@code exp://192.168.1.20:8081/--/auth}.</li>
 *   <li>{@code authDomainPrefix}: prefix of the Cognito hosted domain. Must be globally unique.</li>
 *   <li>{@code apiDomain} + {@code apiCertificateArn}: optional custom domain for the API
 *       (the certificate must be in us-east-1, as CloudFront requires).</li>
 *   <li>{@code apiTasks}: number of API containers (default 1).</li>
 * </ul>
 *
 * <p>Stacks: {@code Progression-Auth} (Cognito), {@code Progression-Data} (VPC +
 * PostgreSQL), {@code Progression-Api} (Fargate + load balancer + CloudFront).
 */
public final class ProgressionInfraApp {

	public static void main(String[] args) {
		App app = new App();

		// Deploy to the account/region of the current AWS CLI credentials.
		Environment env = Environment.builder()
				.account(System.getenv("CDK_DEFAULT_ACCOUNT"))
				.region(System.getenv("CDK_DEFAULT_REGION"))
				.build();

		StackProps props = StackProps.builder().env(env).build();
		AuthStack auth = new AuthStack(app, "Progression-Auth", props, authConfig(app, env));
		DataStack data = new DataStack(app, "Progression-Data", props);
		new ApiStack(app, "Progression-Api", props, apiConfig(app, auth, data));

		app.synth();
	}

	static ApiStack.Config apiConfig(App app, AuthStack auth, DataStack data) {
		String domain = (String) app.getNode().tryGetContext("apiDomain");
		String certificate = (String) app.getNode().tryGetContext("apiCertificateArn");
		Object tasks = app.getNode().tryGetContext("apiTasks");
		int desiredCount = tasks == null ? 1 : Integer.parseInt(tasks.toString());
		return new ApiStack.Config(data.getVpc(), data.getDatabase(), auth.getUserPool(), auth.getMobileClient(),
				domain, certificate, desiredCount);
	}

	static AuthStack.Config authConfig(App app, Environment env) {
		String googleClientId = (String) app.getNode().tryGetContext("googleClientId");
		String devCallbacks = (String) app.getNode().tryGetContext("devCallbackUrls");
		String domainPrefix = (String) app.getNode().tryGetContext("authDomainPrefix");

		List<String> devCallbackUrls = devCallbacks == null ? List.of()
				: Arrays.stream(devCallbacks.split(",")).map(String::trim).filter(s -> !s.isEmpty()).toList();
		if (domainPrefix == null) {
			domainPrefix = "progression-" + (env.getAccount() != null ? env.getAccount() : "dev");
		}
		return new AuthStack.Config(domainPrefix, googleClientId, devCallbackUrls);
	}
}
