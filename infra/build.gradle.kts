// AWS CDK app (Java) that defines Progression's cloud infrastructure.
// `cdk synth` / `cdk deploy` run this program via `./gradlew -q run` (see cdk.json).
plugins {
	java
	application
}

java {
	toolchain {
		languageVersion = JavaLanguageVersion.of(25)
	}
}

repositories {
	mavenCentral()
}

dependencies {
	implementation("software.amazon.awscdk:aws-cdk-lib:2.273.0")
	implementation("software.constructs:constructs:10.8.1")

	testImplementation(platform("org.junit:junit-bom:5.13.4"))
	testImplementation("org.junit.jupiter:junit-jupiter")
	testImplementation("org.assertj:assertj-core:3.27.6")
	testRuntimeOnly("org.junit.platform:junit-platform-launcher")
}

application {
	mainClass = "com.progression.infra.ProgressionInfraApp"
}

tasks.test {
	useJUnitPlatform()
}
