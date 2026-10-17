package com.progression.infra;

import java.util.List;
import java.util.Map;

import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.Test;
import software.amazon.awscdk.App;
import software.amazon.awscdk.Environment;
import software.amazon.awscdk.StackProps;
import software.amazon.awscdk.assertions.Match;
import software.amazon.awscdk.assertions.Template;

/**
 * Pins the settings that matter for security and cost in the data and API
 * stacks: nothing reachable from the internet except CloudFront over HTTPS,
 * an encrypted private database, and no NAT gateway.
 */
class ApiStackTest {

	private static Template data;
	private static Template api;

	@BeforeAll
	static void synth() {
		App app = new App();
		StackProps props = StackProps.builder()
				.env(Environment.builder().account("123456789012").region("us-east-1").build())
				.build();
		AuthStack auth = new AuthStack(app, "Auth", props, new AuthStack.Config("progression-test", null, List.of()));
		DataStack dataStack = new DataStack(app, "Data", props);
		ApiStack apiStack = new ApiStack(app, "Api", props, new ApiStack.Config(dataStack.getVpc(), dataStack.getDatabase(),
				auth.getUserPool(), auth.getMobileClient(), null, null, 1));
		data = Template.fromStack(dataStack);
		api = Template.fromStack(apiStack);
	}

	@Test
	void databaseIsSmallPrivateEncryptedAndProtected() {
		data.hasResourceProperties("AWS::RDS::DBInstance", Map.of(
				"DBInstanceClass", "db.t4g.micro",
				"Engine", "postgres",
				"PubliclyAccessible", false,
				"StorageEncrypted", true,
				"DeletionProtection", true,
				"BackupRetentionPeriod", 7));
		data.hasResource("AWS::RDS::DBInstance", Map.of("DeletionPolicy", "Snapshot"));
	}

	@Test
	void noNatGateway() {
		data.resourceCountIs("AWS::EC2::NatGateway", 0);
	}

	@Test
	void loadBalancerIsInternal() {
		api.hasResourceProperties("AWS::ElasticLoadBalancingV2::LoadBalancer", Map.of("Scheme", "internal"));
	}

	@Test
	void cloudFrontServesHttpsOnlyWithoutCaching() {
		api.hasResourceProperties("AWS::CloudFront::Distribution", Map.of(
				"DistributionConfig", Match.objectLike(Map.of(
						"DefaultCacheBehavior", Match.objectLike(Map.of(
								"ViewerProtocolPolicy", "https-only",
								// Managed CachingDisabled policy
								"CachePolicyId", "4135ea2d-6df8-44a3-9df3-4b5a84be39ad"))))));
		api.resourceCountIs("AWS::CloudFront::VpcOrigin", 1);
	}

	@Test
	void tasksRunOnGravitonWithSecretsFromSecretsManager() {
		api.hasResourceProperties("AWS::ECS::TaskDefinition", Map.of(
				"Cpu", "512",
				"Memory", "1024",
				"RuntimePlatform", Map.of("CpuArchitecture", "ARM64", "OperatingSystemFamily", "LINUX"),
				"ContainerDefinitions", List.of(Match.objectLike(Map.of(
						"Secrets", Match.arrayWith(List.of(Match.objectLike(Map.of("Name", "DB_PASSWORD")))),
						"Environment", Match.arrayWith(List.of(Map.of("Name", "SPRING_PROFILES_ACTIVE", "Value", "prod"))))))));
	}

	@Test
	void tasksAcceptTrafficOnlyFromTheLoadBalancer() {
		api.hasResourceProperties("AWS::EC2::SecurityGroupIngress", Map.of(
				"FromPort", 8080,
				"ToPort", 8080,
				"SourceSecurityGroupId", Match.anyValue()));
		api.hasResourceProperties("AWS::ECS::Service", Map.of(
				"DeploymentConfiguration", Match.objectLike(Map.of(
						"DeploymentCircuitBreaker", Map.of("Enable", true, "Rollback", true)))));
	}
}
