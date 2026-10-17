# syntax=docker/dockerfile:1
#
# Production image for the API.
#   docker build -t progression-api backend/
#   docker run -p 8080:8080 -e SPRING_PROFILES_ACTIVE=prod -e DB_URL=... progression-api
#
# Stage 1 builds the jar with the full JDK; stage 2 runs it on a slim JRE as a
# non-root user. The jar is unpacked into Spring Boot's layers (dependencies
# first, our code last) so a code-only change rebuilds and pushes one small layer.

FROM eclipse-temurin:25-jdk AS build
WORKDIR /src
# Gradle wrapper and build files first: dependency downloads are cached until they change.
COPY gradlew settings.gradle.kts build.gradle.kts ./
COPY gradle gradle
RUN ./gradlew --no-daemon dependencies > /dev/null
COPY src src
RUN ./gradlew --no-daemon bootJar -x test \
 && java -Djarmode=tools -jar build/libs/*-SNAPSHOT.jar extract --layers --launcher --destination /extracted

FROM eclipse-temurin:25-jre-alpine
RUN addgroup -S app && adduser -S -G app -H app
WORKDIR /app
COPY --from=build /extracted/dependencies/ ./
COPY --from=build /extracted/spring-boot-loader/ ./
COPY --from=build /extracted/snapshot-dependencies/ ./
COPY --from=build /extracted/application/ ./
USER app
EXPOSE 8080
# Size the heap from the container's memory limit, not the host's.
ENV JAVA_TOOL_OPTIONS="-XX:MaxRAMPercentage=75 -XX:+ExitOnOutOfMemoryError"
ENTRYPOINT ["java", "org.springframework.boot.loader.launch.JarLauncher"]
