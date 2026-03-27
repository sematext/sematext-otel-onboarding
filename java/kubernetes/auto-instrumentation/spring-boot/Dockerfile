# Build stage
FROM maven:3.9-eclipse-temurin-17 AS build
WORKDIR /app

# Copy pom.xml and download dependencies
COPY pom.xml .
RUN mvn dependency:go-offline -B

# Copy source code and build
COPY src ./src
RUN mvn clean package -DskipTests

# Runtime stage
# The OTel Java agent is not included in this image.
# It is injected at runtime via a Kubernetes init container.
FROM eclipse-temurin:17-jre-alpine
WORKDIR /app

# Copy built application
COPY --from=build /app/target/app.jar /app/app.jar

EXPOSE 8080

USER 1000

CMD ["java", "-jar", "/app/app.jar"]
