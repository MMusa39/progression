package com.progression.infra;

import java.util.List;
import java.util.Map;

import software.amazon.awscdk.CfnOutput;
import software.amazon.awscdk.Duration;
import software.amazon.awscdk.RemovalPolicy;
import software.amazon.awscdk.Stack;
import software.amazon.awscdk.StackProps;
import software.amazon.awscdk.services.certificatemanager.Certificate;
import software.amazon.awscdk.services.cloudfront.AllowedMethods;
import software.amazon.awscdk.services.cloudfront.BehaviorOptions;
import software.amazon.awscdk.services.cloudfront.CachePolicy;
import software.amazon.awscdk.services.cloudfront.Distribution;
import software.amazon.awscdk.services.cloudfront.OriginProtocolPolicy;
import software.amazon.awscdk.services.cloudfront.OriginRequestPolicy;
import software.amazon.awscdk.services.cloudfront.PriceClass;
import software.amazon.awscdk.services.cloudfront.ViewerProtocolPolicy;
import software.amazon.awscdk.services.cloudfront.origins.VpcOrigin;
import software.amazon.awscdk.services.cloudfront.origins.VpcOriginWithEndpointProps;
import software.amazon.awscdk.services.cognito.UserPool;
import software.amazon.awscdk.services.cognito.UserPoolClient;
import software.amazon.awscdk.services.ec2.CfnSecurityGroupIngress;
import software.amazon.awscdk.services.ec2.Peer;
import software.amazon.awscdk.services.ec2.Port;
import software.amazon.awscdk.services.ec2.SecurityGroup;
import software.amazon.awscdk.services.ec2.SubnetSelection;
import software.amazon.awscdk.services.ec2.SubnetType;
import software.amazon.awscdk.services.ec2.Vpc;
import software.amazon.awscdk.services.ecr.assets.Platform;
import software.amazon.awscdk.services.ecs.AssetImageProps;
import software.amazon.awscdk.services.ecs.AwsLogDriverProps;
import software.amazon.awscdk.services.ecs.Cluster;
import software.amazon.awscdk.services.ecs.ContainerDefinitionOptions;
import software.amazon.awscdk.services.ecs.ContainerImage;
import software.amazon.awscdk.services.ecs.CpuArchitecture;
import software.amazon.awscdk.services.ecs.DeploymentCircuitBreaker;
import software.amazon.awscdk.services.ecs.FargateService;
import software.amazon.awscdk.services.ecs.FargateTaskDefinition;
import software.amazon.awscdk.services.ecs.LogDriver;
import software.amazon.awscdk.services.ecs.OperatingSystemFamily;
import software.amazon.awscdk.services.ecs.PortMapping;
import software.amazon.awscdk.services.ecs.RuntimePlatform;
import software.amazon.awscdk.services.ecs.Secret;
import software.amazon.awscdk.services.elasticloadbalancingv2.ApplicationListener;
import software.amazon.awscdk.services.elasticloadbalancingv2.ApplicationLoadBalancer;
import software.amazon.awscdk.services.elasticloadbalancingv2.ApplicationProtocol;
import software.amazon.awscdk.services.elasticloadbalancingv2.ApplicationTargetGroup;
import software.amazon.awscdk.services.elasticloadbalancingv2.HealthCheck;
import software.amazon.awscdk.services.elasticloadbalancingv2.TargetType;
import software.amazon.awscdk.services.logs.LogGroup;
import software.amazon.awscdk.services.logs.RetentionDays;
import software.amazon.awscdk.services.rds.DatabaseInstance;
import software.constructs.Construct;

/**
 * The API: the Spring Boot container on ECS Fargate, reachable only through
 * CloudFront over HTTPS.
 *
 * <pre>
 *   phone ──HTTPS──▶ CloudFront ──(VPC origin, private)──▶ internal ALB ──▶ Fargate task ──▶ RDS
 *                                                                             └──▶ Cognito keys, Open Food Facts, Expo push
 * </pre>
 *
 * <ul>
 *   <li><b>CloudFront</b> terminates TLS on its own {@code *.cloudfront.net}
 *       certificate, so no domain is required (a custom domain and ACM
 *       certificate can be added via context). Caching is off: every request is
 *       an authenticated API call, forwarded with its Authorization header.</li>
 *   <li><b>Internal load balancer</b> in isolated subnets: no public address.
 *       CloudFront reaches it through a VPC origin, so the only way in is HTTPS
 *       through CloudFront.</li>
 *   <li><b>Fargate</b> on Graviton (ARM64, ~20% cheaper), 0.5 vCPU / 1 GB, in
 *       public subnets for outbound internet without a NAT gateway; its security
 *       group accepts traffic only from the load balancer. Deployments are rolling
 *       with a circuit breaker that rolls back a release that fails health checks.</li>
 *   <li>The image is built from {@code backend/Dockerfile} during {@code cdk deploy}
 *       and pushed to an ECR repository CDK manages.</li>
 * </ul>
 */
public class ApiStack extends Stack {

	/**
	 * @param vpc / database        from {@link DataStack}
	 * @param userPool / mobileClient from {@link AuthStack}: the issuer and audience the API trusts
	 * @param customDomain          optional: a domain name for the API (e.g. api.example.com)
	 * @param certificateArn        optional: an ACM certificate in us-east-1 covering {@code customDomain}
	 * @param desiredCount          number of API tasks (1 is enough to start)
	 */
	public record Config(Vpc vpc, DatabaseInstance database, UserPool userPool, UserPoolClient mobileClient,
			String customDomain, String certificateArn, int desiredCount) {
	}

	private final Distribution distribution;

	public ApiStack(Construct scope, String id, StackProps props, Config config) {
		super(scope, id, props);
		Vpc vpc = config.vpc();
		DatabaseInstance database = config.database();

		Cluster cluster = Cluster.Builder.create(this, "Cluster").vpc(vpc).build();

		FargateTaskDefinition task = FargateTaskDefinition.Builder.create(this, "Task")
				.cpu(512)
				.memoryLimitMiB(1024)
				.runtimePlatform(RuntimePlatform.builder()
						.cpuArchitecture(CpuArchitecture.ARM64)
						.operatingSystemFamily(OperatingSystemFamily.LINUX)
						.build())
				.build();

		LogGroup logs = LogGroup.Builder.create(this, "Logs")
				.retention(RetentionDays.ONE_MONTH)
				.removalPolicy(RemovalPolicy.DESTROY)
				.build();

		task.addContainer("Api", ContainerDefinitionOptions.builder()
				.image(ContainerImage.fromAsset("../backend", AssetImageProps.builder().platform(Platform.LINUX_ARM64).build()))
				.portMappings(List.of(PortMapping.builder().containerPort(8080).build()))
				.environment(Map.of(
						"SPRING_PROFILES_ACTIVE", "prod",
						"DB_URL", "jdbc:postgresql://" + database.getDbInstanceEndpointAddress() + ":"
								+ database.getDbInstanceEndpointPort() + "/" + DataStack.DATABASE_NAME,
						"COGNITO_ISSUER_URI", config.userPool().getUserPoolProviderUrl(),
						"COGNITO_CLIENT_ID", config.mobileClient().getUserPoolClientId()))
				.secrets(Map.of(
						"DB_USERNAME", Secret.fromSecretsManager(database.getSecret(), "username"),
						"DB_PASSWORD", Secret.fromSecretsManager(database.getSecret(), "password")))
				.logging(LogDriver.awsLogs(AwsLogDriverProps.builder().logGroup(logs).streamPrefix("api").build()))
				.build());

		// --- Load balancer: internal, in the isolated subnets.
		SecurityGroup albSecurityGroup = SecurityGroup.Builder.create(this, "AlbSecurityGroup")
				.vpc(vpc)
				.description("Internal ALB: HTTP from inside the VPC only (where the CloudFront VPC origin endpoints run)")
				.allowAllOutbound(true)
				.build();
		albSecurityGroup.addIngressRule(Peer.ipv4(vpc.getVpcCidrBlock()), Port.tcp(80), "CloudFront VPC origin");

		ApplicationLoadBalancer alb = ApplicationLoadBalancer.Builder.create(this, "Alb")
				.vpc(vpc)
				.internetFacing(false)
				.vpcSubnets(SubnetSelection.builder().subnetType(SubnetType.PRIVATE_ISOLATED).build())
				.securityGroup(albSecurityGroup)
				.build();

		// --- Service: public subnets for outbound internet; inbound only from the ALB.
		SecurityGroup serviceSecurityGroup = SecurityGroup.Builder.create(this, "ServiceSecurityGroup")
				.vpc(vpc)
				.description("API tasks: port 8080 from the load balancer only")
				.allowAllOutbound(true)
				.build();
		serviceSecurityGroup.addIngressRule(albSecurityGroup, Port.tcp(8080), "Load balancer");

		FargateService service = FargateService.Builder.create(this, "Service")
				.cluster(cluster)
				.taskDefinition(task)
				.desiredCount(config.desiredCount())
				.assignPublicIp(true)
				.vpcSubnets(SubnetSelection.builder().subnetType(SubnetType.PUBLIC).build())
				.securityGroups(List.of(serviceSecurityGroup))
				.minHealthyPercent(100)
				.maxHealthyPercent(200)
				.circuitBreaker(DeploymentCircuitBreaker.builder().rollback(true).build())
				// Spring Boot + Flyway take a while on 0.5 vCPU; don't kill a task that's still starting.
				.healthCheckGracePeriod(Duration.minutes(3))
				.build();
		// Owned by this stack (not the data stack), so the data stack never depends on the API stack.
		CfnSecurityGroupIngress.Builder.create(this, "DatabaseFromApi")
				.groupId(database.getConnections().getSecurityGroups().getFirst().getSecurityGroupId())
				.sourceSecurityGroupId(serviceSecurityGroup.getSecurityGroupId())
				.ipProtocol("tcp")
				.fromPort(5432)
				.toPort(5432)
				.description("API tasks")
				.build();

		ApplicationTargetGroup targets = ApplicationTargetGroup.Builder.create(this, "Targets")
				.vpc(vpc)
				.port(8080)
				.protocol(ApplicationProtocol.HTTP)
				.targetType(TargetType.IP)
				.targets(List.of(service))
				.healthCheck(HealthCheck.builder()
						.path("/actuator/health/readiness")
						.interval(Duration.seconds(30))
						.healthyThresholdCount(2)
						.unhealthyThresholdCount(3)
						.build())
				.deregistrationDelay(Duration.seconds(20)) // matches the app's graceful-shutdown window
				.build();
		ApplicationListener.Builder.create(this, "Http")
				.loadBalancer(alb)
				.port(80)
				.protocol(ApplicationProtocol.HTTP)
				.defaultTargetGroups(List.of(targets))
				.build();

		// --- CloudFront: HTTPS in front, no caching, everything forwarded.
		Distribution.Builder distributionBuilder = Distribution.Builder.create(this, "Cdn")
				.comment("Progression API")
				.priceClass(PriceClass.PRICE_CLASS_100)
				.defaultBehavior(BehaviorOptions.builder()
						.origin(VpcOrigin.withApplicationLoadBalancer(alb, VpcOriginWithEndpointProps.builder()
								.protocolPolicy(OriginProtocolPolicy.HTTP_ONLY)
								.httpPort(80)
								.build()))
						.viewerProtocolPolicy(ViewerProtocolPolicy.HTTPS_ONLY)
						.allowedMethods(AllowedMethods.ALLOW_ALL)
						.cachePolicy(CachePolicy.CACHING_DISABLED)
						.originRequestPolicy(OriginRequestPolicy.ALL_VIEWER_EXCEPT_HOST_HEADER)
						.build());
		if (config.customDomain() != null && config.certificateArn() != null) {
			distributionBuilder
					.domainNames(List.of(config.customDomain()))
					.certificate(Certificate.fromCertificateArn(this, "Certificate", config.certificateArn()));
		}
		distribution = distributionBuilder.build();

		String apiUrl = config.customDomain() != null && config.certificateArn() != null
				? "https://" + config.customDomain()
				: "https://" + distribution.getDistributionDomainName();
		CfnOutput.Builder.create(this, "ApiUrl").value(apiUrl)
				.description("Set this as EXPO_PUBLIC_API_URL for production builds").build();
		CfnOutput.Builder.create(this, "LogGroupName").value(logs.getLogGroupName())
				.description("API logs (JSON) in CloudWatch").build();
	}

	public Distribution getDistribution() {
		return distribution;
	}
}
