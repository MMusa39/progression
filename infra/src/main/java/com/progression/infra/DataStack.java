package com.progression.infra;

import java.util.List;

import software.amazon.awscdk.CfnOutput;
import software.amazon.awscdk.Duration;
import software.amazon.awscdk.RemovalPolicy;
import software.amazon.awscdk.Stack;
import software.amazon.awscdk.StackProps;
import software.amazon.awscdk.Token;
import software.amazon.awscdk.services.ec2.InstanceClass;
import software.amazon.awscdk.services.ec2.InstanceSize;
import software.amazon.awscdk.services.ec2.InstanceType;
import software.amazon.awscdk.services.ec2.SubnetConfiguration;
import software.amazon.awscdk.services.ec2.SubnetSelection;
import software.amazon.awscdk.services.ec2.SubnetType;
import software.amazon.awscdk.services.ec2.Vpc;
import software.amazon.awscdk.services.rds.Credentials;
import software.amazon.awscdk.services.rds.DatabaseInstance;
import software.amazon.awscdk.services.rds.DatabaseInstanceEngine;
import software.amazon.awscdk.services.rds.PostgresEngineVersion;
import software.amazon.awscdk.services.rds.PostgresInstanceEngineProps;
import software.amazon.awscdk.services.rds.StorageType;
import software.constructs.Construct;

/**
 * The network and the database: the long-lived part of the system, kept in
 * its own stack so redeploying the API can never touch the data.
 *
 * <ul>
 *   <li><b>VPC</b> across two availability zones with public subnets (the API
 *       tasks, which need outbound internet for Cognito keys, Open Food Facts and
 *       Expo push) and isolated subnets with no internet route at all (the
 *       database and the internal load balancer). There's deliberately no NAT
 *       gateway: at ~$32/month it would cost more than everything else combined.</li>
 *   <li><b>PostgreSQL 18</b> on a Graviton db.t4g.micro (free-tier eligible),
 *       encrypted, never publicly accessible, 7 days of point-in-time backups,
 *       deletion protection, and a final snapshot if the stack is ever destroyed.
 *       The master password is generated into Secrets Manager; no one types it.</li>
 * </ul>
 */
public class DataStack extends Stack {

	public static final String DATABASE_NAME = "progression";

	private final Vpc vpc;
	private final DatabaseInstance database;

	public DataStack(Construct scope, String id, StackProps props) {
		super(scope, id, props);

		vpc = Vpc.Builder.create(this, "Vpc")
				.maxAzs(2)
				.natGateways(0)
				.subnetConfiguration(List.of(
						SubnetConfiguration.builder().name("public").subnetType(SubnetType.PUBLIC).cidrMask(24).build(),
						SubnetConfiguration.builder().name("isolated").subnetType(SubnetType.PRIVATE_ISOLATED).cidrMask(24).build()))
				.build();

		database = DatabaseInstance.Builder.create(this, "Database")
				.engine(DatabaseInstanceEngine.postgres(PostgresInstanceEngineProps.builder().version(PostgresEngineVersion.VER_18).build()))
				.instanceType(InstanceType.of(InstanceClass.BURSTABLE4_GRAVITON, InstanceSize.MICRO))
				.vpc(vpc)
				.vpcSubnets(SubnetSelection.builder().subnetType(SubnetType.PRIVATE_ISOLATED).build())
				.credentials(Credentials.fromGeneratedSecret("progression"))
				.databaseName(DATABASE_NAME)
				.allocatedStorage(20)
				.maxAllocatedStorage(100)
				.storageType(StorageType.GP3)
				.storageEncrypted(true)
				.publiclyAccessible(false)
				.multiAz(false)
				.backupRetention(Duration.days(7))
				.deletionProtection(true)
				.removalPolicy(RemovalPolicy.SNAPSHOT)
				.build();

		CfnOutput.Builder.create(this, "DatabaseEndpoint").value(database.getDbInstanceEndpointAddress())
				.description("PostgreSQL host (reachable only from inside the VPC)").build();
	}

	/**
	 * The zones to use, named rather than looked up from the account, so
	 * {@code cdk synth} works without AWS credentials (CI). Zones "a" and "b"
	 * exist in every commercial region.
	 */
	@Override
	public List<String> getAvailabilityZones() {
		String region = getRegion();
		return Token.isUnresolved(region) ? super.getAvailabilityZones() : List.of(region + "a", region + "b");
	}

	public Vpc getVpc() {
		return vpc;
	}

	public DatabaseInstance getDatabase() {
		return database;
	}
}
